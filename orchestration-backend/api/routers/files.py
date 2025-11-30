"""
File Processing Router
OCR, Text Extraction, File Analysis
LibreChat Architecture: Handles file uploads and asynchronous processing
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List
import os
import tempfile
from services.file_processor import file_processor
from celery_app import celery_app
from tasks import process_file_task

router = APIRouter()

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/files/upload")
async def upload_file(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """
    Upload and process file.
    File processing (OCR, text extraction) happens asynchronously via Celery.
    """
    # Validate file type
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Save file temporarily
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Queue file processing task (async via Celery)
    task = process_file_task.delay(file_path, ext)
    
    return {
        "filename": file.filename,
        "size": len(content),
        "type": ext,
        "status": "uploaded",
        "task_id": task.id,
        "message": "File processing started in background"
    }

@router.post("/files/analyze")
async def analyze_file(file: UploadFile = File(...)):
    """
    Analyze uploaded file synchronously (for small files).
    Returns extracted text and metadata immediately.
    """
    # Validate and save file
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Process file
        result = await file_processor.process_file(tmp_path, ext)
        return {
            "filename": file.filename,
            "text": result.get('text', ''),
            "metadata": result.get('metadata', {}),
            "processed": result.get('processed', False)
        }
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

@router.get("/files/status/{task_id}")
async def get_file_processing_status(task_id: str):
    """Get status of file processing task"""
    from celery.result import AsyncResult
    
    task = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task.state,
        "result": task.result if task.ready() else None
    }

