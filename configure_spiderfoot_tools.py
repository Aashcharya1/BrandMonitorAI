#!/usr/bin/env python3
"""
Configure SpiderFoot with external tool paths for vulnerability scanning.
This script sets up snallygaster and Nuclei paths in the SpiderFoot database.
"""

import os
import sys

# Add spiderfoot to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'spiderfoot'))

from spiderfoot import SpiderFootDb, SpiderFootHelpers

def main():
    # Get the database path
    db_path = os.path.join(SpiderFootHelpers.dataPath(), 'spiderfoot.db')
    
    print(f"Configuring SpiderFoot tools in database: {db_path}")
    
    # Initialize database
    db = SpiderFootDb({"__database": db_path})
    
    # Get absolute paths
    project_root = os.path.dirname(os.path.abspath(__file__))
    
    # Snallygaster path (Python script installed via pip)
    snallygaster_path = r"C:\Users\Aashcharya\AppData\Local\Programs\Python\Python312\Scripts\snallygaster"
    
    # Nuclei paths
    nuclei_path = os.path.join(project_root, "tools", "nuclei", "nuclei.exe")
    nuclei_template_path = os.path.join(project_root, "tools", "nuclei-templates")
    
    # Convert to Windows paths if needed
    if os.path.exists(nuclei_path):
        nuclei_path = os.path.abspath(nuclei_path)
    else:
        print(f"Warning: Nuclei not found at {nuclei_path}")
        nuclei_path = ""
    
    if os.path.exists(nuclei_template_path):
        nuclei_template_path = os.path.abspath(nuclei_template_path)
    else:
        print(f"Warning: Nuclei templates not found at {nuclei_template_path}")
        nuclei_template_path = ""
    
    # Check if snallygaster exists
    if not os.path.exists(snallygaster_path):
        # Try to find it in PATH
        import shutil
        snallygaster_path = shutil.which('snallygaster') or snallygaster_path
        if not snallygaster_path or not os.path.exists(snallygaster_path):
            print(f"Warning: Snallygaster not found at {snallygaster_path}")
            snallygaster_path = ""
    
    # Configure tools
    config = {}
    
    if snallygaster_path:
        config["sfp_tool_snallygaster:snallygaster_path"] = snallygaster_path
        print(f"[OK] Configured snallygaster: {snallygaster_path}")
    else:
        print("[WARN] Snallygaster path not configured (tool not found)")
    
    if nuclei_path:
        config["sfp_tool_nuclei:nuclei_path"] = nuclei_path
        print(f"[OK] Configured Nuclei binary: {nuclei_path}")
    else:
        print("[WARN] Nuclei binary path not configured (tool not found)")
    
    if nuclei_template_path:
        config["sfp_tool_nuclei:template_path"] = nuclei_template_path
        print(f"[OK] Configured Nuclei templates: {nuclei_template_path}")
    else:
        print("[WARN] Nuclei templates path not configured (templates not found)")
    
    # Save configuration
    if config:
        try:
            db.configSet(config)
            print("\n[SUCCESS] Configuration saved successfully!")
            print("\nYou can now use these modules in SpiderFoot scans:")
            if snallygaster_path:
                print("  - sfp_tool_snallygaster (for finding file leaks and security problems)")
            if nuclei_path and nuclei_template_path:
                print("  - sfp_tool_nuclei (for vulnerability scanning)")
        except Exception as e:
            print(f"\n[ERROR] Error saving configuration: {e}")
            sys.exit(1)
    else:
        print("\n[ERROR] No tools configured. Please ensure tools are installed.")
        sys.exit(1)

if __name__ == "__main__":
    main()

