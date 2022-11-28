"use strict";

import * as UTILS from "./utils.js";
import {Combat} from "./combat.js";
import * as ITEMS from "./items.js";
import { unlocks } from "./colony.js";
import { createCombatant } from "./io.js";

export const encountertype = UTILS.enumerate("COMBAT","CHOICE", "CALLBACK", "MESSAGE", "REWARD", "NONE");
/**
 * Item Description parameter of various functions
 * @typedef {Object} ItemDescription
 * @property {String} type - Reward Type
 * @property {Number} id - ID for the specific Item or Type
 * @property {Number} qty - Quantity of the item
 */

/**
 * Here is a master list of all possible Encounter Options.
 * @typedef {Object} EncounterOptions
 * @property {Game} game - The GAME object
 * @property {String} exitbutton - Text to display on the exitbutton
 * @property {Function} onexit - Callback to attach to the exitbutton
 * 
 * // CombatEncounters
 * * @param {Character} [options.enemy] - The Enemy for the encounter
 * 
 * // ChoiceEncounters
 * @param {String} [options.message] - The Message to display to the user
 * @param {Choice[]} [option.choices] - Choice for the player to choose between
 * @param {Function} [option.callback] - A callback to resolve the Player's choice
 * 
 * // RewardEncounters
 * @param {Reward[]} [options.rewards] - A list of rewards to give the player
 * 
 * // MessageEncounter
 * @param {String} [options.message] - The message to display
 * 
 * // CallbackEncounter (Subclass of MessageEncounter)
 * @param {String} [options.message] - The message to display
 * @param {Function} [options.callback] - The function to invoke when the message is displayed
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

export class Choice{
    /**
     * Initializes a new Choice Object
     * @param {*} value - Some value to differentiate this choice from others
     * @param {String} flavor - Message to display on the GUI
     * @param {ItemDescription[]} cost - An array of Item Cost in order to select this choice
     */
    constructor(value, flavor, cost){
        this.value = value;
        this.flavor = flavor;
        this.cost = cost;
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
     * @param {(Encounter|EncounterSequence)[]} encounters - A list of the encounter objects to progress through
     */
    constructor(encounters){
        // If not provided, encounters default to an array;
        if(!encounters || typeof encounters == "undefined") encounters = [];
        this.encounters = Array.from(encounters);
        // Initializing with negative index so that EncounterSequence.increment
        // can always be called
        this.index = -1;
    }

    /**
     * The current encounter. If the current encounter index is a sub Sequence,
     * returns that subsequence's current encounter instead.
     * @returns The current encounter
     */
    get(){
        let result = this.encounters[this.index];
        
        // Don't bother checking for sub Sequence if we don't have this index
        if(!result || typeof result == "undefined") return result;

        // If we're currently in a sub Sequence, return that sequence's get instead
        if(result.constructor.name == "EncounterSequence"){
            return result.get();
        }

        return result;
    }

    /**
     * Increments the current index. If the current encounter index is
     * another EncounterSequence, increments that Encounter Sequence instead;
     * if that EncounterSequence cannot be incremented, increments as normal.
     * @returns {Encounter | null} - Returns the Encounter at the new index, or null if the index is greater than the Sequence length
     */
    increment(){
        let result = this.encounters[this.index];

        // Don't bother checking for sub Sequence if we don't have this index
        // and the index is not -1 (brand new Sequence)
        if((!result || typeof result == "undefined") && this.index !== -1) return result;
        
        // If we're currently on a Subsequence, increment that instead
        // Index -1 is always going to be undefined, so don't do this check for that index
        if(this.index > -1 && result.constructor.name == "EncounterSequence"){
            // Result is actually the result of the Subseqeunce
            result = result.increment();

            // Return the subsequence's result if it has one
            if(result && typeof result !== "undefined") return result;

            // If it doesn't have one, we'll increment our index like normal
        }
        // Cap the increment at one past the index of our last encounter
        this.index= Math.min(this.index+1, this.encounters.length);
        result = this.encounters[this.index];

        // If no more Encounters just return
        if(!result || typeof result == "undefined") return result;

        // If the new result is a subsequence, return that subsequence's next increment
        if(result.constructor.name == "EncounterSequence") return result.increment();

        // TODO: May have to recurse again if empty Sub Sequence is supplied

        // Otherwise, we'll return the the Encounter at the new index
        return result;
    }
    /**
     * Adds an encounter to the EncounterSequence
     * @param {Encounter | EncounterSequence} encounter - The encounter to add
     */
    addEncounter(...encounters){
        this.encounters.push(...encounters);
        /**
         *  DEVNOTE- Previously, we had to track the previous size of the encounter list for two reasons:
         *      1) We allowed the index to grow infinitely past this.encounters.length
         *      2) The execution pattern that we were expecting was to always call EncounterSequence.increment
         *          prior to calling EncounterSequence.get().initEncounter()
         *      We now cap the index at Sequence.length (so when an Encounter is added, it is already ready)
         *          and now we don't necessarily enforce that increment is called first
         */
    }

    /**
     * Adds all events from the provided EncounterSequence to the end of this sequence
     * @param {EncounterSequence} encountersequence 
     */
    extendSequence(encountersequence){
        this.encounters.push(...encountersequence.encounters);
    }
}

/**
 * A special EncounterSequence which builds its own encounters and subsequences
 * as they are required.
 */
export class DynamicSequence extends EncounterSequence{

    /**
     * Builder callbacks
     * @callback builderFunc
     * @param {DynamicSequence} dynamicSequence - a reference back to this so the builder
     *          has access to any relevant resources it might need.
     * @returns {EncounterSequence} - The callback should return an EncounterSequence
     */


    /**
     * Initializes a new DynamicSequence
     * @param {Game} game - The game object which will be used to notify when each encounter ends
     * @param {Number} [maxFloor=5] - The last floor number (floors start at 0- which is typically a
     *                                  benign introduction- so maxFloor is the n+1'th encounter)
     * @param {builderFunc} builder - The function used to generate new floors, should accept 
     */
    constructor(game, maxFloor, builder){
        // A DynamicSequence is not initialized with encounters
        super();
        this.game = game;
        // Every DynamicSequence starts at floor 0
        this.floor = 0;
        // maxFloor defaults to 5
        if(!maxFloor || typeof maxFloor == "undefined") maxFloor = 5;
        this.maxFloor = maxFloor;
        this.builder = builder;
        // A flag to indicate to the DynamicSequence when to stop creating floors
        this.quit = false;
    }
    /**
     * The callback to generate a new floor of the DynamicSequence before the previous floor exits
     * It generates a new Encounter and adds it to the EncounterSequence, then calls Game.cycleEncounter
     * in order to laod the next (just added) EncounterSequence/FLoor
     */
     buildNextSegment(){
        // The result of actions taken on the previous segment/floor prevents the Player from
        // continuing futher into the DynamicSequence
        if(this.quit === true ||
        // Or we are past the maxfloor
            this.floor > this.maxFloor){

            // Set our current encounter to undefined so anyone
            // watching sees that we are done
            this.index = this.encounters.length;
            // Setting this.quit for good measure
            this.quit = true;

            // Calling this.game.cycleEvent(true) will result in
            // this sequence automatically being removed and all
            // all relevant listeners being notified
            this.game.cycleEncounter(true);
            return;
        }
        // Each floor might have multiple scenes, so we receive an EncounterSequence back by default
        let encounterSequence = this.builder(this);

        // Update the floor for the next iteration
        this.floor += 1;
        // Add the new sequence
        this.addEncounter(encounterSequence);

        // Have the game add the next floor
        this.game.cycleEncounter();
    }

}

export class Encounter{
    /**
     * Creates a new encounter
     * @param {Symbol} type - an encountertype enumeration
     * @param {Object} options - Specifications of the encounter; depends on encountertype
     * 
     * @param {String} options.exitbutton - The text to display on the exit button
     * @param {Function} [options.onexit] - Alternative callback to attach to the exit button
     */
    constructor(type, options){
        // Make sure type is a valid encounter type
        if(typeof type === "string") type = encountertype[type];
        if(Object.values(encountertype).indexOf(type) < 0) throw new Error("Invalid Type");
        this.type = type;

        this.options = {...options};

        // If the Encounter creates another object to manage it, that object will be set here
        // For example, CombatEncounters create a Combat instance
        this.instance = null;
    }

    get game(){ return this.options.game; }

    /**
     * Runs any additional setup required by the Encounter. Overwrite as necessary in subclasses
     */
    initEncounter(){
        return;
    }

    /**
     * The outward facing hook for initEncounter. Subclasses should overwrite
     * initEncounter rather than this function.
     */
     initialize(){
        this.initEncounter();
        this.game.triggerEvent("encounterinitialized", {encounter: this});
        return;
    }

    getOptions(){
        return {game: this.options.game, exitbutton: this.options.exitbutton, onexit: this.options.onexit};
    }
}

export class CombatEncounter extends Encounter{
    /**
     * @param {Object} options - Encounter Options
     * @param {Character} options.enemy - The Enemy for the encounter
     */
    constructor(options){
        super(encountertype.COMBAT, options);
    }
    /**
     * Initializes a new Combat instance using the supplied game and enemy.
     * @returns {Combat}- The combat object which is also accessible via this.instance
     */
    initEncounter(){
        this.instance = new Combat(this.options.game.PLAYER.getCombatCharacter(), this.options.enemy);
        return this.instance;
    }
    getOptions(){
        let result = super.getOptions();
        result.combat = this.instance;
        return result;
    }    
}

export class ChoiceEncounter extends Encounter{

    /**
     * @param {Object} options - Encounter Options
     * @param {String} options.message - The Message to display to the user
     * @param {Choice[]} option.choices - Choice for the player to choose between
     * @param {Function} option.callback - A callback to resolve the Player's choice
     */
    constructor(options){
        super(encountertype.CHOICE, options);
    }

    getOptions(){
        let result = super.getOptions();
        // We'll need to initialize the cost for each choice
        let choices = [];
        for(let choice of this.options.choices){
            let costs = [];
            for(let cost of choice.cost){
                // Check to see if the cost is already initialized
                if(["Item","Resource"].indexOf(cost.constructor.name) >= 0){
                    // just add it to the list and continue
                    costs.push(cost);
                    continue;
                }
                // Sort out Items and Resources
                if(cost.type == "Item"){
                    // Initialize cost as a Resource
                    let itype = this.options.game.ITEMS.items[cost.id];
                    costs.push(new ITEMS.Item(itype, cost.qty));
                }else if(cost.type == "Resource"){
                    // Initialize cost as a Resource
                    let rtype = this.options.game.ITEMS.resources[cost.id];
                    costs.push(new ITEMS.Resource(rtype, cost.qty));
                }
            }
            choices.push(new Choice(choice.value, choice.flavor, costs));
        }
        Object.assign(result, {message: this.options.message, callback: this.options.callback, choices});
        return result;
    }
}

export class RewardEncounter extends Encounter{
    /**
     * Initializes a new Reward Encounter
     * @param {Object} options - Encounter Options
     * @param {Reward[]} options.rewards - A list of rewards to give the player
     */
    constructor(options){
        super(encountertype.REWARD, options);
    }

    getOptions(){
        let result = super.getOptions();
        result.rewards = [];
        for(let r of this.options.rewards){
            result.rewards.push(parseReward(this.options.game, r));
        }
        return result;
    }
}

/**
 * An encounter that simply displays text on the player's screen
 */
export class MessageEncounter extends Encounter{
    /**
     * Initializes a new Message Encounter
     * @param {Object} options - Encounter Options
     * @param {String} options.message - The message to display
     */
    constructor(options){
        super(encountertype.MESSAGE, options);
    }
    getOptions(){
        let result = super.getOptions();
        result.message = this.options.message;
        return result
    }
}

/**
 * An encounter that displays text on the player's screen
 * and calls a callback when the message is displayed
 */
 export class CallbackEncounter extends MessageEncounter{
    /**
     * Initializes a new Message Encounter
     * @param {Object} options - Encounter Options
     * @param {Function} options.callback - The function to invoke when the message is displayed
     */
    constructor(options){
        super(options);
        // Because MessageEncounter hard-enforces its own type we can't
        // initialize it with our own callback and have to add it later
        this.type = encountertype.CALLBACK
    }
    getOptions(){
        let result = super.getOptions();
        result.callback =  this.options.callback
        return result;
    }
}

/**
 * Creates a new Combat Encounter Sequence which is a CombatEncounter followed by a RewardEncounter. Unspecified values are randomized.
 * @param {Game} game - The game object to get statistics from
 * @param {Character | null} enemy - Enemy ID to fight. Null will produce a random tier 1 encounter
 * @param {ItemDescription[] | null} rewards - A list of rewards. Null will produce random tier 1 rewards
 * @param {Object} options - Additional options
 * @param {String} options.message - Creates a MessageEvent prior to the CombatEvent
 * @param {Function} options.combatexit - Overrides the onexit for the generated CombatEncounter
 * @param {Function} options.rewardexit - Overrides the onexit for the generated RewardEncounter
 * @param {Function} options.messageexit - Overrides the onexit for the generated MessageEncounter (if that encounter is created)
 * @param {Number} [options.tier=1] - If this is a random encounter and/or has random rewards, this will override the tier
 * @returns {EncounterSequence} - Returns the full combat sequence
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

    // The default for cycling Encounters is game.cycleEncounter
    let onexit = game.cycleEncounter.bind(game);
    // Check for overriden onexit for Combat
    let combatexit = onexit;
    if(options.combatexit && typeof options.combatexit !== "undefined") combatexit = options.combatexit;
    // Check for overriden onexit for Reward
    let rewardexit = onexit;
    if(options.rewardexit && typeof options.rewardexit !== "undefined") rewardexit = options.rewardexit;

    let combat = new CombatEncounter({game, enemy, onexit: combatexit});
    let reward = new RewardEncounter({game, rewards: rewardobjs, onexit: rewardexit});

    let sequence = new EncounterSequence()

    if(options.message && typeof options.message !== "undefined"){
        // Check for overriden onexit for Message
        let messageexit = onexit;
        if(options.messageexit && typeof options.messageexit !== "undefined") messageexit = options.messageexit;

        let message = new MessageEncounter({game, message: options.message, onexit: messageexit});
        
        // Start with the message encounter
        sequence.addEncounter(message);
    }

    // Add the combat and reward encounters
    sequence.addEncounter(combat, reward);

    return sequence;
}

/**
 * Converts a list of reward description Objects to actual rewards
 * @param {Game} game - The game to use to parse the rewards
 * @param {ItemDescription} reward - A list of rewards
 */
export function parseReward(game, reward){
    // We were passed a reward object, so return it
    if(reward.constructor.name == "Reward") return reward;

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