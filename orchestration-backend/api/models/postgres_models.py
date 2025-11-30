"""
PostgreSQL Database Models
Structured data storage
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database.postgres import Base

class ScanJob(Base):
    """Scan job tracking"""
    __tablename__ = "scan_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(255), unique=True, index=True, nullable=False)
    target = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="queued")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    # Relationships
    results = relationship("ScanResult", back_populates="job")

class ScanResult(Base):
    """Scan results storage"""
    __tablename__ = "scan_results"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(255), ForeignKey("scan_jobs.scan_id"), nullable=False, index=True)
    asset_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    job = relationship("ScanJob", back_populates="results")

class ChatLog(Base):
    """Chat conversation logs"""
    __tablename__ = "chat_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), index=True, nullable=False)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    metadata = Column(JSON, nullable=True)

