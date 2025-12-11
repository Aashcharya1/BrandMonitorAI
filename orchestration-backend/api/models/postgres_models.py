"""
PostgreSQL Database Models
Structured data storage
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text, Boolean, Float
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


# ==================== Data Leak Monitoring Models ====================

class LeakScan(Base):
    """Data leak scan tracking"""
    __tablename__ = "leak_scans"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(255), unique=True, index=True, nullable=False)
    scan_type = Column(String(50), nullable=False)  # email_breach, domain_breach, exposed_db, repo_secrets, comprehensive
    target = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="queued")
    findings_count = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    configuration = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    findings = relationship("LeakFinding", back_populates="scan")


class LeakFinding(Base):
    """Individual leak findings"""
    __tablename__ = "leak_findings"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(255), ForeignKey("leak_scans.scan_id"), nullable=False, index=True)
    finding_type = Column(String(50), nullable=False, index=True)  # breach, exposed_database, leaked_secret, paste
    source = Column(String(100), nullable=False)  # hibp, shodan, trufflehog, breach_db
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, index=True)  # critical, high, medium, low, info
    target = Column(String(500), nullable=False, index=True)
    data = Column(JSON, nullable=True)
    discovered_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(255), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    
    # Relationships
    scan = relationship("LeakScan", back_populates="findings")


class LeakAlert(Base):
    """Leak monitoring alerts"""
    __tablename__ = "leak_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(255), unique=True, index=True, nullable=False)
    finding_id = Column(Integer, ForeignKey("leak_findings.id"), nullable=True)
    alert_type = Column(String(50), nullable=False)  # new_breach, exposed_db, leaked_secret
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, index=True)
    target = Column(String(500), nullable=False)
    notified = Column(Boolean, default=False)
    notified_at = Column(DateTime, nullable=True)
    notification_channels = Column(JSON, nullable=True)  # ["email", "webhook", "slack"]
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(255), nullable=True)


class MonitoredAsset(Base):
    """Assets being monitored for leaks"""
    __tablename__ = "monitored_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_type = Column(String(50), nullable=False, index=True)  # domain, email, org, repository
    asset_value = Column(String(500), nullable=False, index=True)
    display_name = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True)
    last_scanned_at = Column(DateTime, nullable=True)
    scan_interval_hours = Column(Integer, default=24)
    alert_on_finding = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)


class BreachRecord(Base):
    """Known breach records from HIBP and other sources"""
    __tablename__ = "breach_records"
    
    id = Column(Integer, primary_key=True, index=True)
    breach_name = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    domain = Column(String(255), nullable=True, index=True)
    breach_date = Column(DateTime, nullable=True)
    added_date = Column(DateTime, nullable=True)
    pwn_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    data_classes = Column(JSON, nullable=True)  # ["Emails", "Passwords", "Usernames"]
    is_verified = Column(Boolean, default=False)
    is_sensitive = Column(Boolean, default=False)
    source = Column(String(100), default="hibp")
    last_updated = Column(DateTime, default=datetime.utcnow)


class ExposedCredential(Base):
    """Credentials found in breaches (hashed/redacted)"""
    __tablename__ = "exposed_credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    email_hash = Column(String(64), nullable=True, index=True)  # SHA-256 hash of email
    domain = Column(String(255), nullable=True, index=True)
    breach_name = Column(String(255), nullable=False)
    data_classes_exposed = Column(JSON, nullable=True)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    occurrence_count = Column(Integer, default=1)

