import * as UTILS from "./utils.js";
import {Timer} from "./utils.js";
import { sectorCallbacks } from "./callbacks.js";

// NOTE: powerLevel is our analog for "strength of the fire" in A Dark Room
//          powerLevel is fueled by Batteries (the most basic resource; i.e.- Wood)

// Max powerLevel of TheColony
const MAXPOWER = 10;
// How often Meeple get Hungery (in ms)
export const HUNGERRATE = 10000;

// How many Meeple each level of the Residential Sector can support
export const RESIDENTIALMEEPLE = 4;
// Chance of increasing the Meeple Population
export const RESIDENTIALRATE = .3;
// Number of Meeple The Colony can support without Residential Sectors
export const BASEMEEPLE = 5;

// The Facilities which unlock resource-gathering Jobs for Meeple
// This would be things like the Coal Mine or Steel Mine in A Dark Room
/** TODO: Fill in names */
export const unlocks = UTILS.enumerate("ENGINEER","FARMER","AGRICULTURE","D","E","F");

// Sectors are base upgrades
export const sectors = UTILS.enumerate(
    "RESIDENTIAL",  // Our version of Houses
    "SCOUTBOTS",   // Our version of Traps
    "AGRICULTURE"   // new sector
    )

/**
 * The Player's Home Base
 * This would be the town/village in A Dark Room
 * 
 * DevNote- Resources are stored by ID in the array, which means that the array
 *          may have some/many empty indexes.
 */
export class TheColony extends UTILS.EventListener{
    static EVENTTYPES = UTILS.enumerate(
        "startupdate","endupdate",
        "startmeepleupdate", "endmeepleupdate",
        "startsectorupdate", "endsectorupdate",
        "resourcesmodified", "meeplemodified",
        "sectoradded", "sectorexpanded", "noresources",
        "unlockadded", "nounlock",
        "badtimer"
        );

    /**
     * 
     * @param {Game} game - The current Game Object
     * @param {Number} powerLevel - The amount of power running through the base
     * @param {Sector[]} sectors - An array of Sector instances
     * @param {Symbol[]} unlocks - An array of unlock symbols
     * @param {Resource[]} resources - An array containing Resource Instances
     * @param {Meeple[]} meeples - An  array containing Meeple Instances
     */
    constructor(game, powerLevel, sectors, unlocks, resources, meeples){
        super(TheColony.EVENTTYPES);
        this.game = game;
        this.powerLevel = 0;
        if(Number.isInteger(powerLevel)) this.powerLevel = Math.min(Math.max(0, powerLevel), MAXPOWER);

        let sect = [];
        if(sectors && typeof sectors !== "undefined") sect = Array.from(sectors);
        this.sectors = sect;

        let unl = []
        if(unlocks && typeof unlocks !== "undefined") unl = Array.from(unlocks);
        this.unlocks = unl;

        let res = [];
        if(resources && typeof resources !== "undefined") res = resources;
        this.resources = [];
        // sort resources into this.resources
        for(let resource of res){
            // Make sure we aren't sorting an empty index/object
            if(resource && typeof resource !== "undefined") continue;
            // Store the resource at it's id
            this.resources[resource.resourceType.id] = resource;
        }

        let mep  = [];
        if(meeples && typeof meeples !== "undefined") mep = Array.from(meeples);
        this.meeples = mep;
    }

    /**
     * Attempts to coerce the unlock flag into a valid unlock Symbol and returns
     *  whether or not The Colony has the given unlock
     * @param {Symbol | String} unlock - The unlock to validate
     * @returns {Array} - a length-2 array containing the conversion of the unlock
     *          (undefined if not a valid symbol) and a boolean indicating whether
     *          The Colony has the unlock
     */
    validateUnlock(unlock){
         // Make sure prereq is Symbol
         if(typeof unlock !== "symbol") unlock = unlocks[unlock];

         // Return whether the unlock is in in our unlock list
         return [unlock, this.unlocks.indexOf(unlock) >= 0];
    }

    /**
     * Checks whether The Colony has the given unlocks, returning any it does not have
     * @param {Symbol[] | String[]} unlocks - A list of unlocks to check
     * @returns {Symbol[]}- A list of unlocks that The Colony does not have
     */
    checkUnlocks(unlocks){
        // Make sure we have all the unlocks
        let nounlocks = [];
        let result;
        for (let unlock of unlocks){
            [unlock, result] = this.validateUnlock(unlock);
            if(!result) nounlocks.push(unlock);
        }
        return nounlocks;
    }

    /**
     * Returns an array containing any resources in the given cost that The Colony cannot afford
     * @param {Array[]} cost - An array of length-2 arrays representing resources and quantities
     * @returns {Array[]} - Any of the cost entries which The Colony cannot afford
     */
    checkCost(cost){
        let noresources = [];
        // Check that we can afford the upgrade
        for(let [res, qty] of cost){
            // If we have enough resources, continue
            if(this.resources[res]
                && typeof this.resources[res] !== "undefined"
                && this.resources[res] >= qty) continue;
            // We don't have enough resources, so log it
            noresources[res] = qty;
        }
        return noresources;
    }

    /**
     * Adds the given quantity of the supplied resource this The Colony's inventory
     * @param {ResourceType|Resource|Number} resource - The resource to be added or it's id
     * @param {Number|undefined} qty - The amount to be added to the inventory. If
     *                  not supplied, then resource should be a Resource instance
     *                  and it's quantity will be used instead. Its quantity will
     *                  then be set to 0.
     */
    addResource(resource, qty){
        // Handle if a Resource instance was passed
        if(resource.hasOwnProperty("resourcetype")){
            // We can copy qty if qty is not supplied
            if(typeof qty === "undefined"){
                qty = resource.quantity;
                resource.quantity = 0;
            }
            // We only want the resourcetype
            resource = resource.resourcetype;
        }

        // resource is a ResourceType
        if(resource.hasOwnProperty("id")){
            // Convert it just to an id
            resource = resource.id;
        }

        // If we never had any of this resource, set it to 0 instead of undefined
        if(typeof this.resources[resource] === "undefined") this.resources[resource] = 0;

        // Add qty to our Resource's quantity
        this.resources[resource] += qty;
    }

    /**
     * Adds an unlock symbol to The Colony
     * @param {Symbol} flag - The unlock Symbol to add
     */
    unlock(flag){
        if(typeof flag !== "symbol") flag = unlocks[flag];
        if(typeof flag === "undefined") return;

        // Flag is valid, so add it
        this.unlocks.push(flag);
        
        // Notify listeners that we have a new unlock
        this.triggerEvent(TheColony.EVENTTYPES.unlockadded, {unlock: flag});
    }


    /**
     * Creates a new Meeple, adds it to this.meeples, and returns the Meeple
     * @param {Number} now - performance.now
     */
    addNewMeeple(now){
        // Get now() if necessary
        if(!now || typeof now === "undefined") now = UTILS.now();

        // Create a new Meeple with the Default (0) Job, and it's Job and Hunger
        // Timers should be sync'd with now()
        let meeple = new Meeple(GAME.JOBS[0], now, now);

        // Add Meeple to our list
        this.meeples.push(meeple);

        return meeple;
    }

    /**
     * Adds the given sector to The Colony's sector list
     * @param {Sector} sector - The sector to be added
     * @returns {Sector | null}- If succuessful, returns the sector, otherwise returns null
     */
    addSector(sector){
        // Make sure we don't already have a sector of this type
        for(let sect of this.sectors){
            // If this is a duplicate, return
            if(sect.sectorType == sector.sectorType) return;
        }

        let nounlocks = this.checkUnlocks(sector.prerequisites)
        console.log(this.unlocks, nounlocks);
        // nounlock.length > 0 means we are missing prereqs, so trigger and return
        if(nounlocks.length) return this.triggerEvent(TheColony.EVENTTYPES.nounlock, {sector, nounlocks});

        // We meet all prerequisites, so add Sector
        this.sectors.push(sector);

        // If sector is already Level 1+, grant its unlocks
        if(sector.level >= 1) sector.setflags();

        // Trigger the sectoradded event
        this.triggerEvent(TheColony.EVENTTYPES.sectoradded, {sector});

        return sector;
    }

    /**
     * The background resource-collection loop that runs while
     * the page is open and constantly updates Meeple and Sectors
     */
    colonyLoop(){
        // Get now() so all functions are using the same now()
        let now = UTILS.now();

        // Trigger the startupdate event
        this.triggerEvent(TheColony.EVENTTYPES.startupdate, {now});

        // Handle all meeple subroutines
        let [resourcechange, deadmeeple] = this.meepleLoop(now);

        // Handle all sector subroutines
        this.sectorLoop(now);
        
        // Trigger the endupdate event
        // The endupdate event contains all updates
        this.triggerEvent(TheColony.EVENTTYPES.endupdate, {now, resourcechange, deadmeeple});

        // Set next timeout
        this.loopid = window.setTimeout(this.colonyLoop.bind(this), UTILS.LOOPRATE);
    }

    /**
     * Updates all timers and resolves all consequences on The Colony
     * @param {Number} now - performance.now
     * @returns {Array} A length-2 array containing resourcechange and deadmeeple
     */
    meepleLoop(now){
        // Get now if not provided
        if(!now || typeof now === "undefined") now = UTILS.now();

        // Trigger the startmeepleupdate event
        this.triggerEvent(TheColony.EVENTTYPES.startmeepleupdate, {now});

        // Update all Timers on all Meeples
        this.updateMeepleStates(now);
        
        // Handle consequences of the updated Timers
        let [resourcechange, deadmeeple] = this.resolveMeeple();

        // We gained and/or loss resources, so Trigger event
        if(resourcechange.length) this.triggerEvent(TheColony.EVENTTYPES.resourcesmodified, {resourcechange});

        // We loss Meeple, so Trigger Event
        if(deadmeeple.length) this.triggerEvent(TheColony.EVENTTYPES.meeplemodified, {deadmeeple});

        // Trigger the endmeepleupdateevent
        this.triggerEvent(TheColony.EVENTTYPES.endmeepleupdate, {now});

        return [resourcechange, deadmeeple];
    }

    /**
     * Updates Meeple's Job and Hunger states
     * @param {Number} now - performance.now
     */
    updateMeepleStates(now){
        for(let meeple of this.meeples){
            // Update Job and Hunger Timers
            meeple.updateTimers(now);
        }
    }

    /**
     * For each Meeple:
     *  * If it completed a job, try to collect from it
     *      * If we don't have requiredResources, freeze it
     *  * If it needs food, feed it
     *      * If we don't have food, it dies
     * @param {Number} now - performance.now
     * @returns {Array} - First (0) index is total reource modification, second is Meeple that died of starvation
     */
    resolveMeeple(now){
        // canCollect is used to check job.resourcesRequired
        let canCollect = true;
        // Total Resource Changes for event purproses
        let resources = [];
        // An area to gather dead Meeples so we can  remove and return them
        let deadMeeples = [];
        for(let meeple of this.meeples){
            // Meeple has completed a job since last cycle
            if(meeple.jobTimer.isReady){
                let cantCollect = this.checkCost(meeple.job.resourcesRequired);

                // We can't collect, so freeze the timer
                if(cantCollect.length){
                    meeple.jobTimer.freeze(now);
                } else{
                    // Collect from Job

                    // First pay for the resourcesRequired
                    for(let [resource, qty] of meeple.job.resourcesRequired){
                        // Subtract qty from our Resource's quantity
                        this.resources[resource.id] -= qty;
                        
                        // Add resource modification to resources output
                        if(typeof resources[resource.id] === "undefined") resources[resource.id] = 0;
                        resources[resource.id] -= qty;
                        
                    }
                    // The Collect Resources
                    for(let [resource, qty] of meeple.job.resourcesGenerated){
                        // Adds the amount of qty to this.resources
                        this.addResource(resource, qty);

                        // Add resource modification to resources output
                        if(typeof resources[resource.id] === "undefined") resources[resource.id] = 0;
                        resources[resource.id] += qty;
                    }

                    // Clear Timer's ready flag
                    meeple.jobTimer.clearReady();
                    
                    // Unfreeze Timer if it's frozen
                    if(meeple.jobTimer.isFrozen) meeple.jobTimer.unfreeze(now);
                }
            }

            // Meeple needs to eat
            if(meeple.hungerTimer.isReady){
                // We have no food...
                if(!this.resources[0]
                    || typeof this.resources[0] == "undefined"){
                        // I guess the meeple dies
                        deadMeeples.push(meeple);
                }
                else{
                    // Feed the Meeple
                    this.resources[0] -= 1;
                    meeple.hungerTimer.clearReady();
                }
            }
        }

        // Remove the dead Meeple from the roster
        for(let meeple of deadMeeples){
            // Remove meeple at the given index from this.meeple
            this.meeples.splice(this.meeples.indexOf(meeple),1);
        }

        return [resources, deadMeeples];
    }

    /**
     * Updates all Sector Timers and resolves any consequences
     * DEVNOTE- The residential sector is the proc-ability, so we'll handle it
     *          inline. If we add more, then we should set up a resolveSector
     *          function like we have for Meeple.
     * @param {Number} now - performance.now
     */
    sectorLoop(now){
        // Get now() if not supplied
        if(!now || typeof now === "undefined") now = UTILS.now();

        // Trigger startsectorupdate Event
        this.triggerEvent(TheColony.EVENTTYPES.startsectorupdate, {now});


        for(let sector of this.sectors){
            // We haven't powered this sector on yet
            if(!sector.level) continue;

            // Update timer
            sector.timer.updateCycles(now);

            // Sector is not ready or is Frozen, so skip it
            if(!sector.timer.isReady || sector.timer.isFrozen) continue;

            // Residential is the only sectorType that is a proc ability
            if(sector.sectorType === sectors.RESIDENTIAL){
                // Call the Residential Sector's callback function
                // It will handle everything that needs to be done
                sectorCallbacks[sector.sectorType.description](sector, this, this.game.random);
                // Clear the Residential Sector's timer
                sector.timer.clearReady();
            }
            // All other abilities are activated abilities
            // At this point, the sector isReady but not Frozen
            else{
                // Sectors are frozen without preservation (since they are
                // activated abilities)
                sector.timer.freeze(now);
            }
        }

        // Trigger endsectorupdate Event
        this.triggerEvent(TheColony.EVENTTYPES.endsectorupdate, {now});
        return;
    }

    /**
     * Trigger's the sector's callback if it is ready and clears its Frozen state
     * @param {Sector} sector - The sector to collect from
     */
    triggerSector(sector){
        // We only collect from sectors we control
        // DEVNOTE- As noted elsewhere in the code, normally we should raise
        //          an error, but we we'll just fail silently for simplicity's sake
        if(this.sectors.indexOf(sector) < 0) return;

        // Make sure timer is ready
        // DEVNOTE- Unlike above, we will trigger an event in this case as it
        //          is potentially a common miscall
        if(!sector.timer.isReady) return this.triggerEvent("badtimer", {target: sector});

        // Sector is ready, so call 
        sectorCallbacks[sector.sectorType.description](sector, this, this.game.random);

        // Clear timer
        sector.timer.clearReady();

        // NOTE- Normally, all sectors should be frozen
        if(sector.timer.isFrozen) sector.timer.unfreeze();
    }

    /**
     * @returns {Object[]} - A list of items (objects from items.js) available for purchase in the shop
     * Returns an array of available shop items
     */
    shopItems(){
        let g = this.game;
        let items = [];
        // Go through all the items looking for available items
        for(let item of [...g.ITEMS.items, ...g.ITEMS.armor, ...g.ITEMS.weapons, ...g.ITEMS.transports, ...g.ITEMS.resources]){
            // Item can never be bought in the Shop
            if(item.shopPrerequisites === "undefined") continue;
            console.log(item.shopPrerequisites)

            // Make sure the Colony has all the prerequisites
            let unlocked = true;
            for(let unlock of item.shopPrerequisites){
                let result;
                [unlock,result] = this.validateUnlock(unlock);

                // If we don't have the unlock, set the unlocked flag false
                if(!result) unlocked = false;
            }
            if(unlocked) items.push(item);
        }

        return items;
    }

    /**
     * Adds an item to the PlayerCharacter if TheColony can buy the item
     * @param {Object} item - the item (object from items.js) to be purchased
     */
    purchaseItem(item){
        let nounlocks = this.checkUnlocks(item.shopPrerequisites);
        if(nounlocks.length) return this.triggerEvent(TheColony.EVENTTYPES.nounlocks, {item, nounlocks});

        let noresources = this.checkCost(item.shopCost);
        if(noresources.length) return this.triggerEvent(TheColony.EVENTTYPES.noresources, {item, noresources});

    }
}

/**
 * A worker on the Home Base
 */
class Meeple{

    /**
     * 
     * @param {Job} job - The Job that the Meeple is current performing
     * @param {Number} jobStart - When the Meeple started the job
     * @param {Number} hungerStart - Last time the Meeple ate
     * 
     */
    constructor(job, jobStart, hungerStart){
        this.job = job;
        this.jobTimer = new Timer(jobStart, this.job.collectionTime);
        this.hungerTimer = new Timer(hungerStart, HUNGERRATE);
    }

    /**
     * Assigns a new job to the Meeple, creating a new Timer
     * If the job is not different from its current job, this method returns immediately
     * @param {Job} job - job to assign to the Meeple
     * @param {Number} now - time at which the Meeple started its current job
     */
    assignJob(job, now){
        // Don't do anything if the Meeple's job isn't changing
        if(job == this.job) return;

        // Change job
        this.job = job;
        // Get now if not provided
        if(!now || typeof now === "undefined") now = UTILS.now();

        // Create a new JobTimer for the new Job
        this.jobTimer = new Timer(now, job.collectionTime);
    }

    /**
     * Updates the Meeple's timers (job and hunger)
     * @param {Number} now - Performance.now for the current update cycle
     */
    updateTimers(now){
        this.jobTimer.updateCycles(now);
        this.hungerTimer.updateCycles(now);
    }

}

export class Job{
    /**
     * 
     * @param {Array} resourcesGenerated - An object of resource ID's generated and their quantities
     * @param {Array} resourcesRequired - An object of resource ID's required and their quantities
     * @param {Number} collectionTime - Amount of millis it takes to complete the job
     */
    constructor(resourcesGenerated, resourcesRequired, collectionTime){
        this.resourcesGenerated = resourcesGenerated;
        this.resourcesRequired = resourcesRequired;
        this.collectionTime = collectionTime;
    }
}

export class Sector {
    /**
     * 
     * @param {Symbol} sectorType - The sectortype from the sectors enumeration
     * @param {Symbol[]} prerequisites - Colony.unlocks that are required
     * @param {Number} level - The current level of the Sector
     * @param {Number} maxLevel - The max level the Sector can achieve
     * @param {Number} levelRate - The rate at which resourcesRequired increases for each level
     * @param {Array[]} resourcesRequired - The resources needed to raise the Sector's level
     * @param {String[]} flags - Flags that are set when this Sector is first built
     * @param {Number} collectionTime - Amount of millis the Sector is on cooldown for
     */
    constructor(sectorType, prerequisites, level, maxLevel, levelRate, resourcesRequired, flags, collectionTime){
        this.sectorType = sectorType;
        let prereqs = [];
        // Convert prerequisites if it is undefined
        if(!prerequisites || typeof prerequisites === "undefined") prerequisites = [];
        // Make sure all prerequisites are valid unlock Symbols
        for(let prereq of prerequisites){
            // Convert prerequisite if it is not a Symbol
            if( typeof prereq !== "symbol"){
                // Try to get the prereq Symbol
                // This will result in undefined if not valid
                prereq = unlocks[prereq];
            }
            // Get a list of all (valid) Symbols from unlock
            // Make sure prereq is in the list
            // undefined will never be in the list
            // NOTE: As with other parts of the code, we are simply ignoring problems
            if(Object.values(unlocks).indexOf(prereq) < 0) continue;

            // If valid, add to prereqs array
            prereqs.push(prereq);
        }
        this.prerequisites = prereqs;
        // Unless otherwise specified, Sectors start at level 0
        this.level = typeof level === "undefined" ? 0 : level;
        this.maxLevel = maxLevel;
        // Default levelRate is .2
        this.levelRate = typeof levelRate === "undefined" ? .2 : level;
        this.resourcesRequired = resourcesRequired;
        this.flags = flags;
        this.collectionTime = collectionTime;
        this.timer = undefined;
    }

    /**
     * Calculates the number of resources required to reach the next level
     * @returns {resourcesRequired} - The resources required
     */
    calculateResourceRequirements(){
        let cost = [];
        for(let [res, qty] of this.resourcesRequired){
            cost.push([res, qty + Math.floor(this.level * this.levelRate * qty)])
        }
        return cost;
    }

    /**
     * Gets the cost to raise the Sector's level, then subtracts that from
     * the provided resources. If it can't returns without doing anything.
     * If it can, the Sector's Level is incremented by 1.
     * If the Sector is already max level, return before anything else
     * @param {TheColony} colony - The colony to charge for the upgrade
     * @returns {Sector | null} - Returns null if The Colony is capped or cannot afford the upgrade, otherwise returns the sector
     */
    raiseLevel(colony){
        // Don't level up if we can't
        if(this.level >= this.maxlevel) return;

        // Get cost
        let cost = this.calculateResourceRequirements();

        let noresources = colony.checkCost(cost);

        // If length of noresources > 0, we are missing resources, so trigger and return
        if(noresources.length) return colony.triggerEvent(TheColony.EVENTTYPES.noresources, {sector:this, noresources});

        // Subtract the resources
        for(let [res,qty] of cost){
            colony.resources[res] -= qty;
        }

        // Level Up
        this.level += 1;
        
        // If this is our first level, set any flags and start Timer
        if(this.level == 1){
            this.setFlags();
            this.newTimer();
        }


        // Signal that we have upgraded
        colony.triggerEvent(TheColony.EVENTTYPES.sectorexpanded, {sector: this});
        // Signal that resources have changed
        colony.triggerEvent(TheColony.EVENTTYPES.resourcesmodified, {cost});

        return this;
    }
    
    /**
     * Sets all valid unlock flags provided by this Sector
     */
    setFlags(){
        // No flags, so just return
        if(!this.flags || typeof this.flags === "undefined") return;
        for(let flag of this.flags){
            // Invalid flag, don't do anything
            if(typeof unlocks[flag] !== "Symbol") continue;

            // Set the unlock for the Colony
            colony.unlock(unlocks[flag]);
        }
    }

    newTimer(now){
        if(typeof now === "undefined") now = UTILS.now();
        this.timer = new Timer(now, this.collectionTime);
    }

}