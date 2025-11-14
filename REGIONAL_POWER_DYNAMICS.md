# Regional Power Dynamics

## Overview

The **Regional Power Dynamics** system extends the Renown System with advanced faction management capabilities. This feature allows you to manage faction influence, authority levels, and inter-faction relationships across different regions in your D&D world.

### Key Concepts

- **Regions**: Geographic areas where factions compete for influence
- **Authority**: The power of city guards/law enforcement (0-100%)
- **Faction Power**: The combined influence of factions in a region
- **Power Balance**: Authority + Total Faction Power = 100%
- **Interactions**: Relationships between factions (War, Alliance, Trade)

## Features

### 1. Region Management
Create and manage multiple regions across your world, each with its own authority level representing law enforcement strength.

- **Add Regions**: Create new regions with custom authority levels
- **Set Authority**: Adjust the power of city guards (affects available faction power)
- **Remove Regions**: Delete regions and all associated faction data

### 2. Faction Assignment
Assign factions from your main configuration to specific regions with additional details:

- **Leader**: Who leads the faction in this region
- **Description**: What the faction does in this region
- **Goals**: What the faction wants to achieve
- **Power Distribution**: Automatically balanced based on region authority

### 3. Faction Interactions
Define relationships between factions that affect their power dynamics:

- **War** (-10 power effect): Active conflict between factions
- **Alliance** (+5 power effect): Cooperative relationship
- **Trade Agreement** (+3 power effect): Economic partnership

### 4. Dynamic Power Simulation
Roll dice to simulate power fluctuations over time:

- Random power changes (-10 to +10)
- Interaction effects applied
- Automatic power rebalancing
- Event log tracking all changes

### 5. Data Management
Import and export regional configurations:

- **Export**: Save regional data as JSON
- **Import**: Load previously saved configurations
- **Persistence**: Data automatically saved in Foundry world settings

## How to Use

### Setup Process

1. **Open Admin Panel**
   - Click the Renown System settings button in Foundry
   - Navigate to the "Regional Power" tab

2. **Create Regions**
   - Enter a region name (e.g., "Waterdeep", "Baldur's Gate")
   - Set authority level (0-100%):
     - Low (0-30%): Lawless, faction-controlled
     - Medium (30-60%): Mixed control
     - High (60-100%): Strong law enforcement
   - Click "Add Region"

3. **Assign Factions**
   - Select a faction from the dropdown (must be created in Factions tab first)
   - Select the target region
   - Optionally add leader, description, and goals
   - Click "Assign Faction"
   - Repeat for all factions in each region

4. **Set Interactions**
   - Select Faction A from any region
   - Choose interaction type
   - Select Faction B from any region
   - Click "Set Interaction"

5. **Simulate Power Changes**
   - Click "Roll Dice" to trigger a power shift
   - Review the event log for what happened
   - Power automatically rebalances to maintain the Authority/Power equilibrium

### Example Scenario

**Region: Waterdeep** (Authority: 40%)
- Available Faction Power: 60%

**Factions:**
- Lords' Alliance (Power: 30%)
  - Leader: Laeral Silverhand
  - Alliance with: Harpers
  - War with: Zhentarim

- Harpers (Power: 20%)
  - Leader: Remallia Haventree
  - Alliance with: Lords' Alliance

- Zhentarim (Power: 10%)
  - Leader: Davil Starsong
  - War with: Lords' Alliance

**After Rolling Dice:**
- Lords' Alliance gets +5 power from Harpers alliance
- Lords' Alliance gets -10 power from Zhentarim war
- Zhentarim gets -10 power from Lords' Alliance war
- Random fluctuations apply
- All powers rebalance to total 60%

## Integration with Renown System

The Regional Power system works alongside the existing Renown tracker:

- **Renown**: Tracks reputation (-100 to +100) - "How much they like/hate you"
- **Regional Power**: Tracks political/military influence (0-100%) - "How much control they have"

Both systems use the same factions but measure different aspects of faction dynamics.

### Workflow Example

1. **Create Factions** (Factions & Cities tab)
   - Define faction names
   - Set renown bonuses for different levels
   - Establish friend/enemy relationships

2. **Set Regional Power** (Regional Power tab)
   - Assign factions to regions
   - Define local leadership
   - Set faction interactions
   - Simulate power dynamics

3. **Track Renown** (Renown Tracker)
   - Adjust base renown as party interacts with factions
   - Monitor friend/enemy modifiers
   - See how renown affects available bonuses

## Tips & Best Practices

### Authority Levels

- **0-20%**: Anarchic cities, gang territories, frontier towns
- **20-40%**: Contested regions, corrupt officials, weak governance
- **40-60%**: Normal cities with functioning government
- **60-80%**: Well-policed cities, military strongholds
- **80-100%**: Authoritarian states, martial law zones

### Power Distribution

- Let the system auto-balance power after changes
- Use "Roll Dice" regularly to add dynamism to your campaign
- Export configurations before major changes
- Track power shifts over multiple sessions for campaign continuity

### Faction Interactions

- War: Use for active conflicts, reduces both factions' power
- Alliance: Use for formal partnerships, small mutual boost
- Trade: Use for economic relationships, small boost to both

### Campaign Integration

1. **Session Prep**: Roll dice before each session to update the political landscape
2. **Player Impact**: Manually adjust power when players significantly help/harm a faction
3. **Story Hooks**: Use the event log to generate plot ideas
4. **Long-term Tracking**: Export data between campaign arcs

## Technical Details

### Data Structure

```javascript
{
  regions: {
    "Region Name": {
      authority: 50,
      factions: [
        {
          name: "Faction Name",
          power: 25.0,
          leader: "Leader Name",
          description: "Description",
          goals: "Goals",
          interactions: [
            {
              type: "war",
              target: "Other Faction",
              region: "Other Region"
            }
          ]
        }
      ]
    }
  },
  factionDetails: {
    "Faction Name": {
      regions: ["Region 1", "Region 2"]
    }
  }
}
```

### Power Balance Algorithm

1. Calculate available power: `100 - authority`
2. Apply random fluctuations to each faction
3. Apply interaction effects
4. Normalize total faction power to match available power
5. Ensure no negative power values

### Storage

- Data stored in Foundry world settings: `game.settings.get('renown-system', 'regionalData')`
- Automatically synchronized across connected clients via Foundry sockets
- Can be exported as standalone JSON for backup/sharing

## Troubleshooting

**Power doesn't balance correctly**
- Authority + Total Faction Power should always equal 100%
- If not, try adjusting authority slider to trigger rebalancing

**Factions not showing in dropdowns**
- Ensure factions are created in the "Factions & Cities" tab first
- Refresh the admin panel if needed

**Import fails**
- Ensure JSON file is valid
- Check that imported data has correct structure
- Try exporting a valid configuration first to see the expected format

**Changes not saving**
- Ensure you have GM permissions
- Check browser console for errors
- Try closing and reopening the admin panel

## Future Enhancements

Potential additions to this system:

- Visual map integration
- Historical power tracking graphs
- Automatic random events
- Territory control mechanics
- Economic system integration
- Warfare simulation rules

## Credits

**Regional Power Dynamics** system integrated into Renown System.

Original Renown System: Faction and City reputation tracker
Regional Power addition: Faction influence and authority management

Combines concepts from:
- D&D Faction mechanics
- Political simulation systems
- Territory control systems
