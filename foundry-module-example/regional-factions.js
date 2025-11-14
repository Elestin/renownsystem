/**
 * Regional Factions - Power Dynamics System
 * Manages regional authority, faction power, and interactions
 */

class RegionalFactionsManager {
    constructor() {
        this.interactions = {
            war: { powerEffect: -10, description: 'is at war with' },
            alliance: { powerEffect: 5, description: 'is allied with' },
            trade: { powerEffect: 3, description: 'has a trade agreement with' }
        };
        this.eventLog = [];
    }

    /**
     * Initialize default regional data structure
     */
    static getDefaultRegionalData() {
        return {
            regions: {},
            factionDetails: {} // Extended faction information
        };
    }

    /**
     * Create or update a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     * @param {number} authority - Authority level (0-100)
     */
    setRegion(regionalData, regionName, authority = 0) {
        if (!regionalData.regions[regionName]) {
            regionalData.regions[regionName] = {
                authority: authority,
                factions: []
            };
        } else {
            regionalData.regions[regionName].authority = authority;
        }
        return regionalData;
    }

    /**
     * Remove a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region to remove
     */
    removeRegion(regionalData, regionName) {
        delete regionalData.regions[regionName];
        return regionalData;
    }

    /**
     * Add a faction to a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     * @param {string} factionName - Name of the faction
     * @param {Object} details - Additional faction details
     */
    addFactionToRegion(regionalData, regionName, factionName, details = {}) {
        if (!regionalData.regions[regionName]) {
            this.setRegion(regionalData, regionName, 0);
        }

        const faction = {
            name: factionName,
            power: 50, // Starting power
            interactions: [],
            leader: details.leader || 'Unknown',
            description: details.description || 'No description',
            goals: details.goals || 'No goals'
        };

        regionalData.regions[regionName].factions.push(faction);

        // Store extended faction details
        if (!regionalData.factionDetails[factionName]) {
            regionalData.factionDetails[factionName] = {
                regions: []
            };
        }
        regionalData.factionDetails[factionName].regions.push(regionName);

        this.balancePower(regionalData, regionName);
        return regionalData;
    }

    /**
     * Remove a faction from a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     * @param {string} factionName - Name of the faction
     */
    removeFactionFromRegion(regionalData, regionName, factionName) {
        if (!regionalData.regions[regionName]) return regionalData;

        const index = regionalData.regions[regionName].factions.findIndex(
            f => f.name === factionName
        );

        if (index !== -1) {
            regionalData.regions[regionName].factions.splice(index, 1);

            // Update faction details
            if (regionalData.factionDetails[factionName]) {
                const regionIndex = regionalData.factionDetails[factionName].regions.indexOf(regionName);
                if (regionIndex !== -1) {
                    regionalData.factionDetails[factionName].regions.splice(regionIndex, 1);
                }
                // Remove faction details if no longer in any region
                if (regionalData.factionDetails[factionName].regions.length === 0) {
                    delete regionalData.factionDetails[factionName];
                }
            }

            this.balancePower(regionalData, regionName);
        }

        return regionalData;
    }

    /**
     * Set an interaction between two factions
     * @param {Object} regionalData - The regional data object
     * @param {string} regionA - Region of faction A
     * @param {string} factionA - Name of faction A
     * @param {string} regionB - Region of faction B
     * @param {string} factionB - Name of faction B
     * @param {string} type - Type of interaction (war, alliance, trade)
     */
    setInteraction(regionalData, regionA, factionA, regionB, factionB, type) {
        if (!this.interactions[type]) return regionalData;

        const factionAObj = this.getFaction(regionalData, regionA, factionA);
        const factionBObj = this.getFaction(regionalData, regionB, factionB);

        if (factionAObj && factionBObj) {
            // Check if interaction already exists
            const existingA = factionAObj.interactions.findIndex(
                i => i.target === factionB && i.region === regionB
            );
            const existingB = factionBObj.interactions.findIndex(
                i => i.target === factionA && i.region === regionA
            );

            if (existingA !== -1) {
                factionAObj.interactions[existingA].type = type;
            } else {
                factionAObj.interactions.push({
                    type: type,
                    target: factionB,
                    region: regionB
                });
            }

            if (existingB !== -1) {
                factionBObj.interactions[existingB].type = type;
            } else {
                factionBObj.interactions.push({
                    type: type,
                    target: factionA,
                    region: regionA
                });
            }
        }

        return regionalData;
    }

    /**
     * Remove an interaction between two factions
     * @param {Object} regionalData - The regional data object
     * @param {string} regionA - Region of faction A
     * @param {string} factionA - Name of faction A
     * @param {string} regionB - Region of faction B
     * @param {string} factionB - Name of faction B
     */
    removeInteraction(regionalData, regionA, factionA, regionB, factionB) {
        const factionAObj = this.getFaction(regionalData, regionA, factionA);
        const factionBObj = this.getFaction(regionalData, regionB, factionB);

        if (factionAObj) {
            factionAObj.interactions = factionAObj.interactions.filter(
                i => !(i.target === factionB && i.region === regionB)
            );
        }

        if (factionBObj) {
            factionBObj.interactions = factionBObj.interactions.filter(
                i => !(i.target === factionA && i.region === regionA)
            );
        }

        return regionalData;
    }

    /**
     * Get a faction object from a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     * @param {string} factionName - Name of the faction
     */
    getFaction(regionalData, regionName, factionName) {
        if (!regionalData.regions[regionName]) return null;
        return regionalData.regions[regionName].factions.find(f => f.name === factionName);
    }

    /**
     * Balance power in a region based on authority level
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     */
    balancePower(regionalData, regionName) {
        const region = regionalData.regions[regionName];
        if (!region) return regionalData;

        const totalFactions = region.factions.length;
        const availablePower = 100 - region.authority;

        if (totalFactions > 0 && availablePower >= 0) {
            let totalPower = region.factions.reduce((sum, faction) => sum + faction.power, 0);

            if (totalPower > availablePower) {
                // Adjust power proportionally to ensure total is not more than available power
                region.factions.forEach(faction => {
                    faction.power = (faction.power / totalPower) * availablePower;
                });
            } else if (totalPower < availablePower) {
                // Distribute available power evenly
                const powerPerFaction = availablePower / totalFactions;
                region.factions.forEach(faction => {
                    faction.power = powerPerFaction;
                });
            }
        }

        return regionalData;
    }

    /**
     * Roll dice to simulate power fluctuations across all regions
     * @param {Object} regionalData - The regional data object
     * @returns {Array} Array of log entries describing changes
     */
    rollDice(regionalData) {
        const logEntries = [];

        for (const regionName in regionalData.regions) {
            const region = regionalData.regions[regionName];
            const totalPower = 100 - region.authority;

            if (region.factions.length > 1) {
                region.factions.forEach(faction => {
                    // Fluctuate power by a random value between -10 and 10
                    const powerChange = Math.floor(Math.random() * 21) - 10;
                    faction.power += powerChange;

                    // Ensure power stays within reasonable bounds
                    if (faction.power < 0) faction.power = 0;

                    logEntries.push({
                        region: regionName,
                        message: `${faction.name} power changed by ${powerChange > 0 ? '+' : ''}${powerChange}`
                    });

                    // Apply interaction effects
                    faction.interactions.forEach(interaction => {
                        const effect = this.interactions[interaction.type];
                        const targetFaction = this.getFaction(
                            regionalData,
                            interaction.region,
                            interaction.target
                        );

                        if (targetFaction && effect) {
                            faction.power += effect.powerEffect;
                            logEntries.push({
                                region: regionName,
                                message: `${faction.name} ${effect.description} ${targetFaction.name}`
                            });
                        }
                    });
                });

                // Adjust total power to match available power
                let currentTotalPower = region.factions.reduce((sum, faction) => sum + faction.power, 0);
                let iterations = 0;
                const maxIterations = 100;

                while (Math.abs(currentTotalPower - totalPower) > 0.1 && iterations < maxIterations) {
                    const difference = currentTotalPower - totalPower;
                    const adjustFaction = region.factions[Math.floor(Math.random() * region.factions.length)];

                    adjustFaction.power -= difference / region.factions.length;
                    if (adjustFaction.power < 0) adjustFaction.power = 0;

                    currentTotalPower = region.factions.reduce((sum, faction) => sum + faction.power, 0);
                    iterations++;
                }

                // Final normalization
                this.balancePower(regionalData, regionName);
            }
        }

        this.eventLog = [...this.eventLog, ...logEntries];
        return logEntries;
    }

    /**
     * Get all event log entries
     */
    getEventLog() {
        return this.eventLog;
    }

    /**
     * Clear event log
     */
    clearEventLog() {
        this.eventLog = [];
    }

    /**
     * Export regional data as JSON
     * @param {Object} regionalData - The regional data object
     */
    exportData(regionalData) {
        return JSON.stringify(regionalData, null, 2);
    }

    /**
     * Import regional data from JSON
     * @param {string} jsonString - JSON string of regional data
     */
    importData(jsonString) {
        try {
            const regionalData = JSON.parse(jsonString);
            // Validate and balance all regions
            for (const regionName in regionalData.regions) {
                this.balancePower(regionalData, regionName);
            }
            return regionalData;
        } catch (error) {
            console.error('Error importing regional data:', error);
            return null;
        }
    }

    /**
     * Get summary statistics for a region
     * @param {Object} regionalData - The regional data object
     * @param {string} regionName - Name of the region
     */
    getRegionStats(regionalData, regionName) {
        const region = regionalData.regions[regionName];
        if (!region) return null;

        const totalFactionPower = region.factions.reduce((sum, f) => sum + f.power, 0);
        const mostPowerfulFaction = region.factions.reduce((max, f) =>
            f.power > max.power ? f : max, { name: 'None', power: 0 }
        );

        return {
            regionName: regionName,
            authority: region.authority,
            factionCount: region.factions.length,
            totalFactionPower: totalFactionPower,
            mostPowerfulFaction: mostPowerfulFaction.name,
            mostPowerfulFactionPower: mostPowerfulFaction.power,
            interactionCount: region.factions.reduce((sum, f) => sum + f.interactions.length, 0)
        };
    }
}

// Export for use in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegionalFactionsManager;
}
