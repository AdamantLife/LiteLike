"use strict";

import * as COLONY from "./colony.js";
import * as UTILS from "./utils.js";

/**
 * Generic Callbacks
 * Mostly for items atm
 */

/**
 * Function factory which produces a "heal" type callback based on the input provided
 * @param {Character} target - Character to heal
 * @param {Number} value - Amount of HP to heal
 * @returns {combatCallback} - Returns the callback for the associated item/ability
 */
function heal(target, value){
    return (activator, opponent)=>{
        let chara = activator;
        if(target == "OPPONENT") chara = opponent;
        // Have target adjust its hp
        chara.adjustHP(value);
    }
}

/**
 * Function factory which produces a callback which places a random weapon
 * held by the opponent onto cooldown
 * @returns {combatCallback} - Returns the callback for the associated item/ability
 */
function disableRandom(){
    return (activator, opponent)=>{
        let weapon = opponent.randomWeapon();
        // Opponent doesn't have weapons
        if(!weapon) return;
        // Reset the cooldown timer
        weapon.cooldown.reset();
    }
}

export const itemCallbacks = Object.freeze({HEAL:heal, DISABLERANDOM: disableRandom });

/**
 * Callback for the Scrap Sector (our version of Gather Wood)
 * Grants The Colony an amount of wood based on the sector's level without variance
 * @param {COLONY.Sector} sector - The Residential Sector
 * @param {COLONY.TheColony} colony - The Colony
 * @param {seedrandom} random - The Game instance's seedrandom
 */
function scrap(sector, colony, random){
    let gain = sector.level * 20
    // Add resources to TheColony
    colony.addResource(2, gain);
    // Let listeners know that resources have been changed
    colony.triggerEvent(COLONY.TheColony.EVENTTYPES.resourcesmodified, {resourcechange: [ [2, gain]]});
}

/**
 * Callback for the Residential Sector.
 * The Residential Sector's Level increases the max number of meeple for TheColony
 * When proc'd, if TheColony can support more meeple, there is a chance
 * up to 4 will be spawned (up to the population cap, minimum 1 if successful)
 * @param {COLONY.Sector} sector - The Residential Sector
 * @param {COLONY.TheColony} colony - The Colony
 * @param {seedrandom} random - The Game instance's seedrandom
 */
function residential(sector, colony, random){
    // The Residential Sector supports 4 meeple per level, and The Colony can support up to 5
    let maxmeeple = sector.level * COLONY.RESIDENTIALMEEPLE + COLONY.BASEMEEPLE;
    // If colony is capped, don't do anything
    if(colony.meeples.length >= maxmeeple) return;

    // Did not generate any meeple
    if(random() > COLONY.RESIDENTIALRATE) return;

    // Determine max number of meeple that can span based on capacity
    let maxnew = maxmeeple - colony.meeples.length;

    // Determine a random number of meeple (using RESIDENTIALMEEPLE
    // as the max number per proc; minimum of 1), and cap it at the slots available
    let meeple = Math.min(Math.floor(random() * COLONY.RESIDENTIALMEEPLE)+1, maxnew);

    // We'll collect new the new meeple so we can trigger the meeplemodified
    // event
    let newmeeple = [];
    let now = UTILS.now();
    for(let i = 0; i < meeple; i++){
        // Add meeple created by colony.addNewMeeple to newmeeple array
        newmeeple.push(colony.addNewMeeple(now));
    }

    // Trigger meeplemodified event
    colony.triggerEvent(COLONY.TheColony.EVENTTYPES.meeplemodified, {newmeeple});
}

/**
 * The SCOUTBOTTABLE represents possible supplies returned by ScoutBots
 * at each level of the ScoutBot Sector
 */
const SCOUTBOTTABLE = {
    1:[[0,3], [2, 3]],
    2:[[0,5], [2, 5]],
    3:[[0,7], [2, 7]],
    4:[[0,9], [2, 9]],
    5:[[0,11], [2, 11]],
    6:[[0,13], [2, 13]],
    7:[[0,15], [2, 15]],
    8:[[0,17], [2, 17]],
    9:[[0,19], [2, 19]],
    10:[[0,21], [2, 21]]
}

/**
 * Callback for the ScoutBots Sector.
 * When activated, the ScoutBots return with a random assortment of resources
 * For now it each level of the ScoutBots Sector returns a random item from a
 * random level of the SCOUTBOTTABLE up to the current Sector Level
 * @param {COLONY.Sector} sector - The Residential Sector
 * @param {COLONY.TheColony} colony - The Colony
 * @param {seedrandom} random - The Game instance's seedrandom
 */
function scoutbots(sector, colony, random){
    // Where we'll collect our resources
    let resources = [];

    // Generate resources for each sector level
    for(let i = 0; i < sector.level; i++){
        // The level to get the resource from (max of sector.level)
        let rewardlevel = Math.floor(random() * sector.level)+1;
        // Pull a random reward from the level
        let [resource, qty] = UTILS.randomChoice(SCOUTBOTTABLE[rewardlevel], random);

        // If resource is not already in the array, make a space for it
        if(typeof resources[resource] === "undefined" || resources[resource] === null)
            resources[resource] = 0;
        
        // Add the resource to resources
        resources[resource]+=qty;

        // Add resources to TheColony
        colony.addResource(resource, qty);
    }

    // Trigger resourcesmodified event
    colony.triggerEvent(COLONY.TheColony.EVENTTYPES.resourcesmodified, {resourcechange: resources});
}

/**
 * 
 * @param {COLONY.Sector} sector - The Residential Sector
 * @param {COLONY.TheColony} colony - The Colony 
 * @param {seedrandom} random - The Game instance's seedrandom
 */
function agriculture(sector, colony, random){
    // Agriculture produces enough food per level to feed one level of Residential
    colony.addResource(0, COLONY.RESIDENTIALMEEPLE * sector.level);
}

export const sectorCallbacks = Object.freeze({ SCRAP: scrap, RESIDENTIAL: residential, SCOUTBOTS: scoutbots, AGRICULTURE: agriculture});