import * as UTILS from "./utils.js";

// NOTE: powerLevel is our analog for "strength of the fire" in A Dark Room
//          powerLevel is fueled by Batteries (the most basic resource; i.e.- Wood)

// Max powerLevel of TheColony
const MAXPOWER = 10;
// How often Meeple get Hungery (in ms)
const HUNGERRATE = 10000;

// The Facilities which unlock resource-gathering Jobs for Meeple
// This would be things like the Coal Mine or Steel Mine in A Dark Room
/** TODO: Fill in names */
const unlocks = UTILS.enumerate("A","B","C","D","E","F");

/**
 * The Player's Home Base
 * This would be the town/village in A Dark Room
 */
export class TheColony {
    /**
     * 
     * @param {Game} game - The current Game Object
     * @param {Number} powerLevel - The amount of power running through the base
     * @param {Symbol[]} unlocks - An array of unlock symbols
     * @param {Resource[]} resources - An array containing Resource Instances
     * @param {Meeple[]} meeples - An  array containing Meeple Instances
     */
    constructor(game, powerLevel, unlocks, resources, meeples){
        this.game = game;
        this.powerLevel = 0;
        if(Number.isInteger(powerLevel)) this.powerLevel = math.min(math.max(0, powerLevel), MAXPOWER);
        let unl = []
        if(unlocks && typeof unlocks !== "undefined") unl = Array.from(unlocks);
        this.unlocks = unl;
        let res = [];
        if(resources && typeof resources !== "undefined") res = Array.from(res);
        this.resources = res;
        let mep  = [];
        if(meeples && typeof meeples !== "undefined") mep = Array.from(meeples);
        this.meeples = mep;
    }

    /**
     * Returns the desired resource based on it's id.
     * If the Colony does not have the Resource, return null.
     * @param {Number} id - The id of the resource to retrieve from this.resources
     * @returns {Resource | null} - Returns the resource if it exists, otherwise null
     */
    getResourceById(id){
        for(let res of this.resources){
            if(res.resourceType === id) return res;
        }
        return null;
    }

    updateLoop(){
        let now = UTILS.now();
        this.updateMeepleStates(now);
        this.collectFromMeeple();
    }

    /**
     * Updates Meeple's Collection and Hunger
     * @param {Number} now - performance.now
     */
    updateMeepleStates(now){
        for(let meeple of this.meeples){
            meeple.updateCollections(now);
            meeple.updateHunger(now);
        }
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
        this.jobStart = jobStart;
        this.hungerStart = hungerStart;
        
        this.collections = 0;
        this.collectFlag = false;

        this.hungers = 0;
        this.hungerFlag = false;
    }

    /**
     * Assigns a new job to the Meeple, resetting it's jobStart and clearing
     * collections and collectFlag
     * If the job is not different from its current job, this method returns immediately
     * @param {Job} job - job to assign to the Meeple
     * @param {Number} now - time at which the Meeple started its current job
     */
    assignJob(job, now){
        if(job == this.job) return;
        this.job = job;
        if(!now || typeof now === "undefined") now = UTILS.now();
        this.jobStart = now;
        this.collections = 0;
        this.collectFlag = false;
    }

    /**
     * Updates how many Collections the Meeple has completed for its current job
     * If the number is incremented, then collectFlag is set to true
     * @param {Number} now - performance.now
     */
    updateCollections(now){
        // How many Job Cycles the Meeple has completed
        let collections = Math.floor(now / this.job.collectionTime);
        // The Meeple has completed one or more Job Cycles since the last time
        // it was updated
        if(collections > this.collections){
            // Update collections
            this.collections = collections;
            // Set Meeple to be collected from
            this.collectFlag = true;
        }
    }

    /**
     * Updates how many hungers the Meeple has felt
     * If the number is incremented, then hungerFlag is set to true
     * @param {Number} now - performance.now
     */
     updateHunger(now){
        // How many Hunger Cycles the Meeple has completed
        let hungers = Math.floor(now / HUNGERRATE);
        // The Meeple has completed one or more Job Cycles since the last time
        // it was updated
        if(hungers > this.hungers){
            // Update collections
            this.hungers = hungers;
            // Set Meeple to be collected from
            this.hungerFlag = true;
        }
    }

    

    /**
     * DEVNOTE - Saving Jobs and Hunger
     * 
     * To save Meeple's Job State, we're just saving how long they've
     * been doing the current cycle of their current job.
     * 
     * Resources should be collected from Meeple before saving.
     * 
     * When we load, we offset the Meeple's jobStart value by that value.
     * 
     * We do not save collections because we only track them in order to
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
     * @param {"job" | "hunger"} property - Either "job" to get the jobStart
     *                          offset, or "hunger" to get the hungerStart offset
     * @param {Number} now - performance.now time: unlike other functions, this
     *                      is not optional because getOffsetTime should be called
     *                      using the same now() for all Meeple
     * @returns 
     */
    getOffsetTime(property, now){
        if(property === "job") return (now - this.jobStart)         // now - jS is how long the job has been performed for
                                        % this.job.collectionTime;  // the modulus gets how much time the current
                                                                    // job cycle has been running
        else if(property === "hunger") return (now - this.hungerStart) % HUNGERRATE;
        
    }

    /**
     * Sets the Meeple's jobStart time to offset-ms before now.
     * In an attempt to preempt exploits, offset is modulo'd by
     * job.CollectionTime or HUNGERRATE as specified
     * @param {"job" | "hunger"} property - Either "job" to set the jobStart
     *                          offset, or "hunger" to set the hungerStart offset
     * @param {Number} now - performance.now time when all Meeples are created
     * @param {Number} offset - Amount to offset the starttime by
     */
    setOffsetTime(property, now, offset){
        // This meeple started their job offset-ms before now()
        // We're modulo'ing offset so that a Meeple can never be loaded with a completed job 
        if(property === "job") this.jobStart = now - (offset % this.job.collectionTime);
        else if(property === "hunger") this.hungerStart = now - (offset % HUNGERRATE);
    }

}

class Job{
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