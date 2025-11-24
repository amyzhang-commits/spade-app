from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, ActionLibrary, TrackedAction, GameSession, GameSessionLog
from app.schemas import (
    ActionLibraryCreate, ActionLibraryResponse,
    TrackedActionCreate, TrackedActionResponse,
    GameSessionLogCreate, GameSessionLogResponse
)
from app.auth import get_current_user

router = APIRouter()

# Action Library endpoints
@router.get("/library", response_model=List[ActionLibraryResponse])
def get_action_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all non-user-created actions plus user's custom actions
    actions = db.query(ActionLibrary).filter(
        (ActionLibrary.user_created == False) |
        (ActionLibrary.created_from_session_id.in_(
            db.query(GameSession.session_id).filter(GameSession.user_id == current_user.user_id)
        ))
    ).order_by(ActionLibrary.times_used.desc()).all()
    return actions

@router.post("/library", response_model=ActionLibraryResponse, status_code=status.HTTP_201_CREATED)
def create_library_action(
    action_data: ActionLibraryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session belongs to user if provided
    if action_data.created_from_session_id:
        session = db.query(GameSession).filter(
            GameSession.session_id == action_data.created_from_session_id,
            GameSession.user_id == current_user.user_id
        ).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

    new_action = ActionLibrary(
        action_description=action_data.action_description,
        default_user_movement=action_data.default_user_movement,
        default_llm_movement=action_data.default_llm_movement,
        created_from_session_id=action_data.created_from_session_id,
        user_created=True
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return new_action

@router.patch("/library/{library_id}", response_model=ActionLibraryResponse)
def update_library_action(
    library_id: int,
    action_data: ActionLibraryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get the action
    action = db.query(ActionLibrary).filter(ActionLibrary.library_id == library_id).first()

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found"
        )

    # Only allow editing user-created actions
    if not action.user_created:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot edit starter actions"
        )

    # Verify the action was created by this user (by checking the session)
    if action.created_from_session_id:
        session = db.query(GameSession).filter(
            GameSession.session_id == action.created_from_session_id,
            GameSession.user_id == current_user.user_id
        ).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this action"
            )

    # Update fields
    action.action_description = action_data.action_description
    action.default_user_movement = action_data.default_user_movement
    action.default_llm_movement = action_data.default_llm_movement

    db.commit()
    db.refresh(action)
    return action

@router.delete("/library/{library_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library_action(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get the action
    action = db.query(ActionLibrary).filter(ActionLibrary.library_id == library_id).first()

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found"
        )

    # Only allow deleting user-created actions
    if not action.user_created:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete starter actions"
        )

    # Verify the action was created by this user
    if action.created_from_session_id:
        session = db.query(GameSession).filter(
            GameSession.session_id == action.created_from_session_id,
            GameSession.user_id == current_user.user_id
        ).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this action"
            )

    db.delete(action)
    db.commit()
    return None

# Tracked Actions endpoints
@router.post("/track", response_model=TrackedActionResponse, status_code=status.HTTP_201_CREATED)
def track_action(
    action_data: TrackedActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session belongs to user
    session = db.query(GameSession).filter(
        GameSession.session_id == action_data.session_id,
        GameSession.user_id == current_user.user_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Create tracked action
    tracked_action = TrackedAction(
        session_id=action_data.session_id,
        library_id=action_data.library_id,
        action_description=action_data.action_description,
        user_movement=action_data.user_movement,
        llm_movement=action_data.llm_movement
    )
    db.add(tracked_action)

    # Update session scores
    session.user_score += action_data.user_movement
    session.llm_score += action_data.llm_movement

    # Update library action times_used if from library
    if action_data.library_id:
        library_action = db.query(ActionLibrary).filter(
            ActionLibrary.library_id == action_data.library_id
        ).first()
        if library_action:
            library_action.times_used += 1

    db.commit()
    db.refresh(tracked_action)
    return tracked_action

@router.get("/session/{session_id}/actions", response_model=List[TrackedActionResponse])
def get_session_actions(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session belongs to user
    session = db.query(GameSession).filter(
        GameSession.session_id == session_id,
        GameSession.user_id == current_user.user_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    actions = db.query(TrackedAction).filter(
        TrackedAction.session_id == session_id
    ).all()
    return actions

# Game Session Logs endpoints
@router.post("/log", response_model=GameSessionLogResponse, status_code=status.HTTP_201_CREATED)
def create_log(
    log_data: GameSessionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session and action belong to user
    session = db.query(GameSession).filter(
        GameSession.session_id == log_data.session_id,
        GameSession.user_id == current_user.user_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    action = db.query(TrackedAction).filter(
        TrackedAction.action_id == log_data.action_id,
        TrackedAction.session_id == log_data.session_id
    ).first()

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found"
        )

    new_log = GameSessionLog(
        session_id=log_data.session_id,
        action_id=log_data.action_id,
        optional_note=log_data.optional_note
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.get("/session/{session_id}/logs", response_model=List[GameSessionLogResponse])
def get_session_logs(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify session belongs to user
    session = db.query(GameSession).filter(
        GameSession.session_id == session_id,
        GameSession.user_id == current_user.user_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    logs = db.query(GameSessionLog).filter(
        GameSessionLog.session_id == session_id
    ).order_by(GameSessionLog.timestamp.asc()).all()
    return logs
