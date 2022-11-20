"use strict";

import * as UTILS from "./utils.js";
import {Combat} from "./combat.js";
import * as ITEMS from "./items.js";
import { unlocks } from "./colony.js";
import { createCombatant } from "./io.js";

export const encountertype = UTILS.enumerate("COMBAT","CHOICE", "CALLBACK", "MESSAGE", "NONE");
/**
 * Reward Description parameter of various functions
 * @typedef {Object} RewardDescription
 * @property {String} type - Reward Type
 * @property {Number} id - ID for the specific Item or Type
 * @property {Number} qty - Quantity of the item
 */

export class Reward{
    /**
     * Initializes a new Reward Object
     * @param {String} type - The reward type
     * @param {*} reward - The rewarded Object
     */
    constructor(type, reward){
        this.type = type;
        this.reward = reward;
    }
}

/**
 * The toplevel container for Encounters. This is the object that gets assigned to
 * GAME.ENCOUNTER and should be used to hold all event types, even if the event is
 * standalone (i.e.- Random Combat Encounters)
 */
export class EncounterSequence{
    /**
     * 
     * @param {Encounter[]} encounters - A list of the encounter objects to progress through
     */
    constructor(encounters){
        this.encounters = Array.from(encounters);
        // Initializing with negative index so that EncounterSequence.increment
        // can always be called
        this.index = -1;
    }

    /**
     * The current encounter
     * @returns The current encounter
     */
    get(){
        return this.encounters[this.index];
    }
    increment(){
        this.index+=1;
        return this.encounters[this.index];
    }
    /**
     * Adds an encounter to the EncounterSequence
     * @param {Encounter} encounter - The encounter to add
     */
    addEncounter(encounter){
        this.encounters.push(encounter);
    }
}

export class Encounter{
    /**
     * Creates a new encounter
     * @param {Symbol} type - an encountertype enumeration
     * @param {Reward[]} reward -  An array of rewards
     * @param {*} options - Specifications of the encounter; depends on encountertype
     */
    constructor(type, reward, options){
        // Make sure type is a valid encounter type
        if(typeof type === "string") type = encountertype[type];
        if(Object.values(encountertype).indexOf(type) < 0) throw new Error("Invalid Type");
        this.type = type;

        this.reward = reward;
        this.options = {...options};
        this.game; 
    }
}

export class CombatEncounter extends Encounter{
    constructor(reward, options){
        super(encountertype.COMBAT, reward, options);

        // Initialized in initEncounter
        this.combat;
    }
    /**
     * Initializes a new Combat instance using the supplied game and enemy.
     * @param {Game} game - The game object to initialize with. Can be null or undefined if game is assigned in CombatEncounter.options
     * @returns {Combat}- The combat object which is also accessible via this.combat
     */
    initEncounter(game){
        if(!game || typeof game == "undefined") game = this.options.game;
        if(!game || typeof game == "undefined") return;
        this.game = game;
        this.combat = new Combat(this.game.PLAYER.getCombatCharacter(), this.options.enemy);
        return this.combat;
    }
}

export class ChoiceEncounter extends Encounter{
    constructor(reward, options){
        super(encountertype.CHOICE, reward, options);
    }
    initEncounter(){
        return {message: this.options.message, choices: this.options.choices};
    }
}

/**
 * An encounter that simply displays text on the player's screen
 */
export class MessageEncounter extends Encounter{
    constructor(reward, options){
        super(encountertype.MESSAGE, reward, options);
    }
    initEncounter(){
        return {message: this.options.message, exitbutton: this.options.exitbutton}
    }
}

/**
 * An encounter that displays text on the player's screen
 * and calls a callback when the message is displayed
 */
 export class CallbackEncounter extends MessageEncounter{
    constructor(reward, options){
        super(reward, options);
        // Because MessageEncounter hard-enforces its own type we can't
        // initialize it with our own callback and have to add it later
        this.type = encountertype.CALLBACK
    }
    initEncounter(){
        let result = super.initEncounter();
        result.callback =  this.options.callback
        return result;
    }
}

/**
 * Creates a new Combat Encounter. Unspecified values are randomized.
 * @param {Game} game - The game object to get statistics from
 * @param {Character | null} enemy - Enemy ID to fight. Null will produce a random tier 1 encounter
 * @param {RewardDescription[] | null} rewards - A list of rewards. Null will produce random tier 1 rewards
 * @param {Number} options.tier - If this is a random encounter and/or has random rewards, this will override the tier
 */
export function buildCombatEncounter(game, enemy, rewards, options){
    if(!options || typeof options == "undefined") options = {};
    // Establish teir preemptively (this may not be a random encounter)
    // If tier is in options, then use it, otherwise default to 1
    let tier = options.tier && options.tier !== "undefined" ? options.tier : 1;

    // TODO: Random Encounter
    enemy =createCombatant(enemy, game.ENCOUNTERS.combatants, game.ITEMS);
    // Invalid Enemy ID
    if(!enemy || typeof enemy == "undefined") return;
    
    // TODO: Random Rewards
    if(!rewards) return;

    let rewardobjs = []
    for(let reward of rewards){
        let result = parseReward(game, reward);
        if(result) rewardobjs.push(result);
    }

    return new CombatEncounter(rewardobjs, {enemy, game})
}

/**
 * Converts a list of reward description Objects to actual rewards
 * @param {Game} game - The game to use to parse the rewards
 * @param {RewardDescription} reward - A list of rewards
 */
export function parseReward(game, reward){
    let obj = null;
    // If qty is provided, use it (defaults to 1)
    let qty = reward.qty && reward.qty !== "undefined" ? reward.qty : 1;
    let lookup;

    
    switch(reward.type){
        // Singletons
        case "Unlock":
            lookup = unlocks;
            break;
        // TODO: Include Character Unlocks
        case "Armor":
            lookup = game.ITEMS.armor;
            break;
        case "Transport":
            lookup = game.ITEMS.transports;
            break;
        // TODO: add Map Reward

        // Others
        case "Item":
            lookup = game.ITEMS.items;
            break;
        case "Weapon":
            lookup = game.ITEMS.weapons;
            break;
        case "Resource":
            lookup = game.ITEMS.resources;
            break;
        }

    // We don't know what this is
    if(!lookup) return;

    // Make sure reward id is valid
    obj = lookup[reward.id] && typeof lookup[reward.id] !== "undefined" ? lookup[reward.id] : null;
    // If reward id is not valid, don't return a reward
    if(!obj) return;

    // We can return Singletons immediately
    if(["Unlock", "Armor", "Transport", "Map"].indexOf(reward.type) > -1){
        // Return Reward Object
        return new Reward(reward.type, obj);
    }

    // Other things require a little bit more effort
    switch(reward.type){
        case "Item":
            obj = new ITEMS.Item(obj, qty);
            break;
        case "Weapon":
            obj = new ITEMS.Weapon(obj);
            break;
        case "Resource":
            obj = new ITEMS.Resource(obj, qty);
            break;
    }
    
    // Object ready to ship
    return new Reward(reward.type, obj);
}