import * as UTILS from "./utils.js";
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

// The Facilities which unlock resource-gathering Jobs for Meeple
// This would be things like the Coal Mine or Steel Mine in A Dark Room
/** TODO: Fill in names */
export const unlocks = UTILS.enumerate("ENGINEER","FARMER","AGRICULTURE","D","E","F");

// Sectors are base upgrades
export const sectors = UTILS.enumerate(
    "RESIDENTIAL",  // Our version of Houses
    "SCOUTBOTS"   // Our version of Traps
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
        "sectoradded", "sectorupgraded",
        "unlockadded"
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
        // If we already have the given unlock, ignore it
        if(this.unlocks.indexOf(flag) >= 0) return;

        // If flag is not a Symbol, try to convert it
        if(typeof flag !== "symbol") flag = unlocks[flag];

        // Make sure flag is a valid unlock Symbol
        // If not, as with other places in the code, we'll just ignore it
        if(Object.values(unlocks).indexOf(flag) < 0) return;

        // Flag is valid, so add it
        this.unlocks.push(flag);
        
        // Notify listeners that we have a new unlock
        this.triggerEvent(TheColony.EVENTTYPES.unlockadded, {unlock});
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
     * @returns {null | Sector}- If succuessful, returns the sector, otherwise returns null
     */
    addSector(sector){
        // Make sure we don't already have a sector of this type
        for(let sect of this.sectors){
            // If this is a duplicate, return
            if(sect.sectorType == sector.sectorType) return;
        }

        // Make sure The Colony meets all prerequisites to add the Sector
        for(let prereq of sector.prerequisites){
            // We don't have the prerequisite unlocked, so return
            if(this.unlocks.indexOf(prereq) < 0) return;
        }

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
                canCollect = true;
                for(let [resource, qty] of meeple.job.resourcesRequired){

                    if(this.resources[resource.id]                                  // We have an entry at that resource id
                        && typeof this.resources[resource.id] !== "undefined"       // It is not undefined
                        && this.resources[resource.id] >= qty) continue;   // We have enough of the resource, so don't worry
                    
                    // We don't have the resource or don't have enough of it
                    // so flag the collection and stop checking other resources
                    canCollect = false;
                    break;
                }

                // We can't collect, so freeze the timer
                if(!canCollect){
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
            // Sector is not ready or is Frozen, so skip it
            if(!sector.timer.isReady || sector.timer.isFrozen) continue;

            // Residential is the only sectorType that is a proc ability
            if(sector.sectorType === sectors.RESIDENTIAL){
                // Call the Residential Sector's callback function
                // It will handle everything that needs to be done
                sectorCallbacks[sector.sectorType.toString()](sector, this, this.game.random);
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

class Timer {
    /**
     * 
     * @param {Number} startTime - performance.now
     * @param {Number} rate - The time that elapses between cycles
     */
    constructor(startTime, rate){
        this.startTime = startTime;
        this.rate = rate;

        this._frozen = null;

        this.cycles = 0;
        this._collectFlag = false;
    }
    

    /**
     * @returns {Boolean} - Whether or not the Timer can be collected from
     */
    get isReady(){
        return Boolean(this._collectFlag);
    }

    /**
     * @returns {Boolean} - Whether or not the Timer is frozen
     */
    get isFrozen(){
        return Boolean(this._frozen);
    }

    /**
     * A function just because we should touch internal variables
     * (and, potentially, the timer may want to do other things when
     * it is no longer ready)
     */
    clearReady(){
        this._collectFlag = false;
    }

    /**
     * Freezes the Timer at the current time offset.
     * Frozen Timers must call unfreeze in order to properly resume functionality
     * @param {Number} now - the runtime ms when the Timer is Frozen
     * @param {Boolean} preserve - Whether or not to preserve the offsetTime; false is
     *                              the default in which case offsetTime is not stored
     */
    freeze(now, preserve){
        // Have to use -1 for _frozen because we simply call Boolean for isFrozen()
        if(!preserve || typeof preserve == "undefined") {this._frozen = -1;}
        else {this._frozen = this.getOffsetTime(now);}
    }

    /**
     * Unfreezes the Timer so it can continue operation
     * @param {Number} now - the runtime ms when the Timer is UnFrozen
     */
    unfreeze(now){
        // To unfreeze a timer, we need to start it counting from now()
        // so we use setOffsetTime to set an oppropriate startTime
        // If _frozen is -1 that indicates that we should offset by 0;
        this.setOffsetTime(now, this._frozen == -1 ? 0 : this._frozen);

        // Set _frozen to null so it no longer isFrozen
        this._frozen = null;
    }

    /**
     * Updates how many cycles the Meeple has completed for its current job
     * If the number is incremented, then collectFlag is set to true
     * @param {Number} now - performance.now
     */
     updateCycles(now){
        // Frozen Timers do not update their cycles
        if(this.isFrozen) return;
        
        // How many Cycles the Timer has completed
        let cycles = Math.floor((now - this.startTime) / this.rate);
        // The Meeple has completed one or more Job Cycles since the last time
        // it was updated
        if(cycles > this.cycles){
            // Set Meeple to be collected from
            /**
             * DEVNOTE- There is no reason at the moment for this._collectFlag
             *      to ever be more than 1 (updateLoops should be running faster
             *      than Timers), but just incase that changes, we'll set it to
             *      the difference instead of just true.
             */
            this._collectFlag = cycles - this.cycles;

            // Update cycles
            this.cycles = cycles;
        }
    }

        /**
     * DEVNOTE - Saving Timers
     * 
     * To save Meeple's Job State, we're just saving how long they've
     * been doing the current cycle of their current job.
     * 
     * Resources should be collected from Meeple before saving.
     * 
     * When we load, we offset the Meeple's jobStart value by that value.
     * 
     * We do not save cycles because we only track them in order to
     * avoid constantly resetting jobStart.
     * 
     * We are using the same exact sytem for Hunger
     * 
     * Example:
     *      Alice the Meeple has been Charging Batteries since 1000ms
     *      Charging Batteries takes 800ms
     *      It is now(): 3512ms
     *      We want to save the gamestate, so we call getOffsetTime on all Meeple
     *      Alice has been Charging Batteries for (3512 - 1000) = 2512ms
     *      Alice has charged (2512 / 800) = 3.14 Batteries
     *      We don't want to lose that .14 of a Battery, so we use (2512 % 800)
     *          to get the number of ms that have been done on that battery (112ms)
     *      When we load the game back up, Alice is recreated at 500ms.
     *      In order to get those 112ms back, we set her jobStart to
     *          (500 - 112) = 388ms; now, she will finish her first Battery in this
     *          game at 1188ms instead of (500+800) = 1300ms.
     */

    /**
     * Returns the modulo'd difference between now and the given startTime.
     * See above note for more information
     * If the Timer isFrozen, returns this._frozen instead (as the getOffsetTime
     *  is already calculated)
     * @param {Number} now - performance.now time: unlike other functions, this
     *                      is not optional because getOffsetTime should be called
     *                      using the same now() for all Meeple
     * @returns {Number} - The modulo'd difference in time
     */
     getOffsetTime(now){
        if(this.isFrozen) return this._frozen;
        return (now - this.startTime)   // (now - jS) is how long the timer has been performed for
                % this.rate;            // the modulus gets how much time the current
                                        // cycle has been running
        
    }

    /**
     * Sets the startTime to offset-ms before now.
     * In an attempt to preempt exploits, offset is modulo'd by rate
     * @param {Number} now - performance.now time when all timers are created
     * @param {Number} offset - Amount to offset the startTime by
     */
    setOffsetTime(now, offset){
        // This timer started offset-ms before now()
        // We're modulo'ing offset so that a timer can never be loaded with a completed cycle
        this.startTime = now - (offset % this.rate);
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
     * @param {Number} maxlevel - The max level the Sector can achieve
     * @param {Number} levelRate - The rate at which resourcesRequired increases for each level
     * @param {Array[]} resourcesRequired - The resources needed to raise the Sector's level
     * @param {String[]} flags - Flags that are set when this Sector is first built
     * @param {Number} collectionTime - Amount of millis the Sector is on cooldown for
     */
    constructor(sectorType, prerequisites, level, maxlevel, levelRate, resourcesRequired, flags, collectionTime){
        this.sectorType = sectorType;
        let prereqs = [];
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
        this.maxlevel = maxlevel;
        // Default levelRate is .2
        this.levelRate = typeof levelRate === "undefined" ? .2 : level;
        this.resourcesRequired = resourcesRequired;
        this.flags = flags;
        this.collectionTime = collectionTime;
        this.timer = new Timer(UTILS.now(), this.collectionTime);
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
     */
    raiseLevel(colony){
        // Don't level up if we can't
        if(this.level >= this.maxlevel) return;

        // Get cost
        cost = this.calculateResourceRequirements();

        // We're going to be calling colony.resources a lot
        let resources = colony.resources;

        // Check that we can afford the upgrade
        for(let [res, qty] of cost){
            // If we can't afford a resource, exit immediately
            if(!resources[res]
                || typeof resources[res] === "undefined"
                || resources[res] < qty) return;
        }

        // Subtract the resources
        for(let [res,qty] of cost){
            resources[res] -= qty;
        }

        // Level Up
        this.level += 1;
        
        // If this is our first level, set any flags
        if(this.level == 1) this.setFlags();
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

}