"""
File Processing Service
OCR, Text Extraction, File Analysis
LibreChat Architecture: Handles file uploads and processing
"""

import os
import logging
from typing import Dict, Any, Optional
from celery import shared_task
import tempfile

logger = logging.getLogger(__name__)

class FileProcessor:
    """Processes uploaded files: OCR, text extraction, analysis"""
    
    def __init__(self):
        # OCR library (optional - install pytesseract for OCR)
        try:
            import pytesseract
            from PIL import Image
            self.ocr_available = True
        except ImportError:
            logger.warning("OCR libraries not installed (pytesseract, Pillow)")
            self.ocr_available = False
    
    async def process_file(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Process file: OCR for images/PDFs, extract text for documents
        """
        result = {
            'text': '',
            'metadata': {},
            'processed': False
        }
        
        try:
            if file_type in ['png', 'jpg', 'jpeg']:
                # Image OCR
                if self.ocr_available:
                    result['text'] = await self._extract_text_from_image(file_path)
                    result['processed'] = True
                else:
                    result['text'] = "OCR not available"
            
            elif file_type == 'pdf':
                # PDF text extraction
                result['text'] = await self._extract_text_from_pdf(file_path)
                result['processed'] = True
            
            elif file_type in ['txt', 'doc', 'docx']:
                # Document text extraction
                result['text'] = await self._extract_text_from_document(file_path, file_type)
                result['processed'] = True
            
            # Analyze extracted text
            if result['text']:
                result['metadata'] = await self._analyze_text(result['text'])
            
            return result
        
        except Exception as e:
            logger.error(f"File processing failed: {e}")
            return result
    
    async def _extract_text_from_image(self, file_path: str) -> str:
        """Extract text from image using OCR"""
        if not self.ocr_available:
            return ""
        
        try:
            import pytesseract
            from PIL import Image
            
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ""
    
    async def _extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        try:
            # Try PyPDF2 first
            try:
                import PyPDF2
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in pdf_reader.pages:
                        text += page.extract_text() + "\n"
                    return text.strip()
            except ImportError:
                # Fallback to basic text extraction
                logger.warning("PyPDF2 not installed, using basic extraction")
                return ""
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            return ""
    
    async def _extract_text_from_document(self, file_path: str, file_type: str) -> str:
        """Extract text from document files"""
        try:
            if file_type == 'txt':
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            elif file_type in ['doc', 'docx']:
                # Requires python-docx
                try:
                    from docx import Document
                    doc = Document(file_path)
                    return "\n".join([para.text for para in doc.paragraphs])
                except ImportError:
                    logger.warning("python-docx not installed")
                    return ""
        except Exception as e:
            logger.error(f"Document extraction failed: {e}")
            return ""
    
    async def _analyze_text(self, text: str) -> Dict[str, Any]:
        """Analyze extracted text for insights"""
        return {
            'length': len(text),
            'word_count': len(text.split()),
            'language': 'en',  # TODO: Detect language
            'has_code': '```' in text or 'def ' in text or 'function' in text
        }

# Global file processor instance
file_processor = FileProcessor()

