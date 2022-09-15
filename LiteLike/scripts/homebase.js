import * as UTILS from "./utils.js";

// NOTE: powerLevel is our analog for "strength of the fire" in A Dark Room
//          powerLevel is fueled by Batteries (the most basic resource; i.e.- Wood)

// Max powerLevel of TheColony
const MAXPOWER = 10;
// How often Meeple get Hungery (in ms)
export const HUNGERRATE = 10000;

// The Facilities which unlock resource-gathering Jobs for Meeple
// This would be things like the Coal Mine or Steel Mine in A Dark Room
/** TODO: Fill in names */
const unlocks = UTILS.enumerate("ENGINEER","FARMER","AGRICULTURE","D","E","F");

// Sectors are base upgrades
const sectors = UTILS.enumerate(
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
    static EVENTTYPES = UTILS.enumerate("startupdate","endupdate","resourcesmodified", "meeplemodified");

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
     * @param {ResourceType|Resource} resource - The resource to be added
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

        // If we never had any of this resource, set it to 0 instead of undefined
        if(typeof this.resources[resource.id] === "undefined") this.resources[resource.id] = 0;

        // Add qty to our Resource's quantity
        this.resources[resource.id] += qty;
    }


    /**
     * Creates a new Meeple, adds it to this.meeples, and returns the Meeple
     * @param {Number} now - performance.now
     */
    addNewMeeple(now){
        if(!now || typeof now === "undefined") now = UTILS.now();
        let meeple = new Meeple(GAME.JOBS[0], now, now);
        this.meeples.push(meeple);
        return meeple;
    }

    /**
     * Updates all timers and resolves all consequences on The Colony
     */
    updateLoop(){
        let now = UTILS.now();
        this.triggerEvent(TheColony.EVENTTYPES.startupdate, {now});
        this.updateMeepleStates(now);
        let [resourcechange, deadmeeple] = this.resolveMeeple();
        // We gained and/or loss resources
        if(resourcechange.length) this.triggerEvent(TheColony.EVENTTYPES.resourcesmodified, {resourcechange});
        // We loss Meeple
        if(deadmeeple.length) this.triggerEvent(TheColony.EVENTTYPES.meeplemodified, {deadmeeple});
        this.triggerEvent(TheColony.EVENTTYPES.endupdate, {now});
    }

    /**
     * Updates Meeple's Job and Hunger states
     * @param {Number} now - performance.now
     */
    updateMeepleStates(now){
        for(let meeple of this.meeples){
            // Update Job and Hunger Timers
            meeple.updateTimers();
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
                }
            }
        }

        // Remove the dead Meeple from the roster
        for(let meeple of this.deadMeeples){
            // Remove meeple at the given index from this.meeple
            this.meeples.splice(this.meeples.indexOf(meeple),1);
        }

        return [resources, deadMeeples];
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
        if(job == this.job) return;
        this.job = job;
        if(!now || typeof now === "undefined") now = UTILS.now();
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
        return this._collectFlag;
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
            // Update cycles
            this.cycles = cycles;
            // Set Meeple to be collected from
            this._collectFlag = true;
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
     * @param {Object} resourcesGenerated - An object of resource ID's generated and their quantities
     * @param {Object} resourcesRequired - An object of resource ID's required and their quantities
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
     * @param {Symbol[]} prerequisites - Colony.unlocks that are required
     * @param {*} level - The current level of the Sector
     * @param {*} maxlevel - The max level the Sector can achieve
     * @param {*} levelRate - The rate at which resourcesRequired increases for each level
     * @param {*} resourcesRequired - The resources needed to raise the Sector's level
     * @param {*} flags - Flags that are set when this Sector is first built
     */
    constructor(prerequisites, level, maxlevel, levelRate, resourcesRequired, flags){
        this.prerequisites = prerequisites;
        this.level = level;
        this.maxlevel = maxlevel;
        this.levelRate = levelRate;
        this.resourcesRequired = resourcesRequired;
        this.flags = flags;
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
        if(this.level == 1){
            for(let flag of this.flags){
                // Invalid flag, don't do anything
                if(typeof unlocks[flag] !== "Symbol") continue;

                // Set the unlock for the Colony
                colony.unlocks.push(unlocks[flag]);
            }
        }
    }

}