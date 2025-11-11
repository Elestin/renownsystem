# Quick Start - Local Installation

## For Local Testing (Right Now)

1. **Find your Foundry Data folder:**
   - Press `Windows Key + R`
   - Type: `%localappdata%\FoundryVTT\Data\modules`
   - Press Enter

2. **Copy and rename:**
   - Copy the entire `foundry-module-example` folder
   - Paste it into the modules folder
   - **Rename it to `renown-system`** (this is critical - must match the ID in module.json)

3. **Restart Foundry VTT completely** (close and reopen)

4. **Enable the module:**
   - Open/create a world
   - Go to **Setup** → **Manage Modules**
   - Find "Renown System" and check the box
   - Click **Update Modules**

5. **Access it:**
   - **Admin**: Settings → Module Settings → Renown System → Configure World
   - **Tracker**: Look for ⭐ icon in Scene Controls (left sidebar)

## If It Still Doesn't Show Up

1. **Check the folder name** - Must be exactly `renown-system` (not `foundry-module-example`)
2. **Check the location** - Should be: `...\FoundryVTT\Data\modules\renown-system\`
3. **Check module.json exists** - Should be at: `...\renown-system\module.json`
4. **Check console for errors:**
   - Press F12 in Foundry
   - Look at Console tab for red errors
   - Common issues: JSON syntax errors, missing files

## File Checklist

Make sure these files exist in `renown-system\`:
- ✅ `module.json`
- ✅ `renown-system.js`
- ✅ `styles\renown-system.css`
- ✅ `templates\renown-tracker.html`
- ✅ `templates\admin-config.html`

## For Distribution (Later)

If you want to share it via manifest URL:
1. Upload to GitHub
2. Create a Release
3. Update the manifest/download URLs in module.json
4. Users install via: Setup → Add-on Modules → Install Module → Paste manifest URL

