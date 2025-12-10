# Vulnerability Scanning Tools Installation

## Summary

The following tools have been successfully downloaded, installed, and configured for use with SpiderFoot:

## 1. Snallygaster

**Status:** ✅ Installed and Configured

**Location:** `C:\Users\Aashcharya\AppData\Local\Programs\Python\Python312\Scripts\snallygaster`

**Description:** Finds file leaks and other security problems on HTTP servers. Typical examples include publicly accessible git repositories, backup files potentially containing passwords or database dumps.

**SpiderFoot Module:** `sfp_tool_snallygaster`

**Installation Method:** Installed via pip
```bash
pip install snallygaster
```

## 2. Nuclei

**Status:** ✅ Installed and Configured

**Location:**
- Binary: `F:\Zeroshield\BrandMonitorAI\tools\nuclei\nuclei.exe`
- Templates: `F:\Zeroshield\BrandMonitorAI\tools\nuclei-templates`

**Description:** Fast and customisable vulnerability scanner based on simple YAML based DSL. Can detect thousands of vulnerabilities across various technologies.

**SpiderFoot Module:** `sfp_tool_nuclei`

**Installation Method:** 
- Downloaded Windows binary from GitHub releases
- Cloned nuclei-templates repository

**Version:** v3.2.4

## Configuration

The tools have been configured in SpiderFoot's database using the `configure_spiderfoot_tools.py` script.

**Configuration Keys:**
- `sfp_tool_snallygaster:snallygaster_path` = Path to snallygaster executable
- `sfp_tool_nuclei:nuclei_path` = Path to nuclei.exe
- `sfp_tool_nuclei:template_path` = Path to nuclei-templates directory

## Integration

These modules have been added to the MVP scan configuration:

1. **Backend (`orchestration-backend/api/routers/external_surface.py`):**
   - Added `sfp_tool_snallygaster` and `sfp_tool_nuclei` to `content_modules` (Layer 4)
   - Added to `active_modules` list

2. **Frontend (`src/app/external-surface-monitoring/page.tsx`):**
   - Added modules to available modules list

## Usage

These modules will now be automatically included in MVP scans and will:

1. **Snallygaster (`sfp_tool_snallygaster`):**
   - Scan for file leaks (git repos, backups, database dumps)
   - Find security problems on HTTP servers
   - Produces: `VULNERABILITY_GENERAL`, `VULNERABILITY_CVE_*` events

2. **Nuclei (`sfp_tool_nuclei`):**
   - Fast vulnerability scanning using YAML templates
   - Detects thousands of known vulnerabilities
   - Produces: `VULNERABILITY_GENERAL`, `VULNERABILITY_CVE_*` events

## Event Types Produced

Both tools produce vulnerability events that are categorized as **Layer 4: Leaks & Risks**:

- `VULNERABILITY_GENERAL`
- `VULNERABILITY_CVE_CRITICAL`
- `VULNERABILITY_CVE_HIGH`
- `VULNERABILITY_CVE_MEDIUM`
- `VULNERABILITY_CVE_LOW`

These will appear in the "Leaks & Risks" counter on the dashboard when vulnerabilities are found.

## Updating Templates

To update Nuclei templates (recommended periodically):

```bash
cd F:\Zeroshield\BrandMonitorAI\tools\nuclei
.\nuclei.exe -update-templates
```

Or manually update the templates repository:

```bash
cd F:\Zeroshield\BrandMonitorAI\tools\nuclei-templates
git pull
```

## Troubleshooting

If modules fail to run:

1. **Check tool paths:** Verify the tools exist at the configured paths
2. **Check SpiderFoot logs:** Look for error messages about missing tools
3. **Re-run configuration:** Run `python configure_spiderfoot_tools.py` again
4. **Verify permissions:** Ensure SpiderFoot has permission to execute the tools

## Notes

- These tools perform **active scanning** and will make requests to target servers
- They are included in MVP scans by default
- Tools must be properly configured in SpiderFoot database for modules to work
- Nuclei templates are updated automatically on first run, but manual updates are recommended periodically

