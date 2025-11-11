# Installation Instructions for Renown System

## Local Development Installation

For testing the module locally in Foundry VTT:

### Step 1: Copy Module to Foundry Directory

1. Navigate to your Foundry VTT data directory:
   - **Windows**: Usually `%localappdata%\FoundryVTT\Data\modules\`
   - **Mac**: Usually `~/Library/Application Support/FoundryVTT/Data/modules/`
   - **Linux**: Usually `~/.local/share/FoundryVTT/Data/modules/`

2. Copy the entire `foundry-module-example` folder to that location
3. **Rename the folder** from `foundry-module-example` to `renown-system` (the folder name must match the module ID)

### Step 2: Restart Foundry VTT

1. Close Foundry VTT completely
2. Restart Foundry VTT
3. The module should now appear in the module list

### Step 3: Enable the Module

1. Create or open a world in Foundry
2. Go to **Setup** → **Manage Modules**
3. Find "Renown System" in the list
4. Check the box to enable it
5. Click **Update Modules**

### Step 4: Access the Module

- **Admin Panel**: Settings → Module Settings → Renown System → **Configure World**
- **Renown Tracker**: Look for the star icon (⭐) in the Scene Controls (left sidebar)

## Troubleshooting

### Module Not Showing Up?

1. **Check folder name**: Must be exactly `renown-system` (matches the `id` in module.json)
2. **Check location**: Must be in `Data/modules/renown-system/`
3. **Check module.json**: Open it and verify it's valid JSON (no syntax errors)
4. **Check console**: Press F12 in Foundry, look for errors in the Console tab
5. **Restart Foundry**: Sometimes Foundry needs a full restart to detect new modules

### Common Errors

- **"Module not found"**: Check that all files referenced in module.json exist
- **"Syntax error"**: Check module.json for JSON syntax errors
- **"Class not defined"**: Make sure renown-system.js is loading correctly

## Distribution via Manifest URL

If you want to distribute the module via a manifest URL (for others to install):

### Step 1: Host on GitHub

1. Create a GitHub repository
2. Upload all files from `foundry-module-example`
3. Create a **Release** (e.g., v1.0.0)
4. Upload a zip file containing all module files

### Step 2: Update module.json

Update these fields in `module.json`:

```json
{
  "url": "https://github.com/YOUR_USERNAME/renown-system",
  "manifest": "https://github.com/YOUR_USERNAME/renown-system/releases/latest/download/module.json",
  "download": "https://github.com/YOUR_USERNAME/renown-system/releases/latest/download/renown-system.zip"
}
```

### Step 3: Create Release Structure

For each release, you need:
- `module.json` file (the manifest)
- `renown-system.zip` file (all module files zipped)

Users can then install via:
1. Foundry VTT → Setup → Add-on Modules
2. Click "Install Module"
3. Enter the manifest URL: `https://github.com/YOUR_USERNAME/renown-system/releases/latest/download/module.json`

## File Structure

Your module should have this structure:

```
renown-system/
├── module.json              ← Module manifest (required)
├── renown-system.js         ← Main JavaScript file (required)
├── README.md                ← Documentation (optional)
├── styles/
│   └── renown-system.css    ← Stylesheet
└── templates/
    ├── renown-tracker.html  ← Tracker template
    └── admin-config.html    ← Admin config template
```

## Testing Checklist

- [ ] Module appears in module list
- [ ] Module can be enabled/disabled
- [ ] No console errors on load
- [ ] Admin panel opens from Settings
- [ ] Renown Tracker opens from Scene Controls
- [ ] Can add/edit factions
- [ ] Can set relationships
- [ ] Renown tracking works
- [ ] Export/Import works

