"use strict";

import * as UTILS from "./utils.js";

const LOOPRATE = 1000 / 16; // 1 second in ms, at 16fps

/**
 * Description of a combat callback
 * DEVNOTE- Since we're emulating A Dark Room, we're only concerned with 1v1
 * Combat. If this changes in the future, we will need to updat this callback
 * to have multiple targets
 * 
 * @callback combatCallback
 * @param {Character} activator - the owner of the effect
 * @param {Character} opponent - the enemy of the owner of the effect
 */

export const actiontypes = UTILS.enumerate(["WEAPON","ITEM"])

export class CharacterAction{
    /**
     * 
     * @param {Character} activator - The character taking the action
     * @param {Symbol} actiontype - an actiontype
     * @param {Weapon | Item} object - the item or weapon being used
     * @param {Character} opponent - The character's opponent
     */
    constructor(activator, actiontype, object, opponent){
        this.activator = activator;
        this.opponent = opponent;
        this.actiontype = actiontype;
        this.object = object;
    }
}


/**
 * A Combat Instance
 */
export class Combat{
    static EVENTTYPES = UTILS.enumerate("startloop","endloop","startstack","endstack","useweapon", "useitem");

    /**
     * 
     * @param {Character} player - The Player Character
     * @param {Character} enemy - The Enemy Character
     */
    constructor(player, enemy){
        this.player = player;
        this.enemy = enemy;
        this.victor = null;
        this.starttime = UTILS.now();
        this.playerQueue = [];
        this.playerDistance = weaponranges.RANGED;
        this.enemyDistance = weaponranges.RANGED;
        
        // Super Simple EventListener setup
        this._listeners = {};
        for(let sym of Object.values(Combat.EVENTTYPES)){
            this._listeners[sym] = [];
        }
    }

    /**
     * Internal method to validate the Eventtype passed to Add and Remove Listeners
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @returns {Symbol} - The enumerated symbol from EVENTTYPES
     */
    _validateEventType(eventtype){
        // If eventtype is a string, convert it to the Enumerated value
        if(typeof eventtype == "string"){ 
            // note that this may result in undefined if this is not a
            // valid eventtype string, which will fail the next check
            eventtype = Combat.EVENTTYPES[eventtype];
        }
        
        // Check that eventtype is a Symbol in EVENTTYPES
        // As with other places in the code, this should raise an Error,
        // but we're trying to keep this simple so we'll just fail silently
        if(Object.values(Combat.EVENTTYPES).indexOf(eventtype) < 0) return;

        return eventtype;
    }

    /**
     * Adds an eventlistener to the Combat
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @param {Function} callback - The callback to call
     */
    addEventListener(eventtype, callback){
        // Make sure eventtype is valid
        eventtype = this._validateEventType(eventtype);
        // If eventtype was invalid, it will now be null and we will fail silently
        if(!eventtype) return;
        
        // Event has already been registered, so do nothing
        if(this._listeners[eventtype].indexOf(callback) > -1) return;

        // Register the callback under its type
        this._listeners[eventtype].append(callback);
    }

    /**
     * Removes an eventlistener from the Combat
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration)
     * @param {*} callback - The callback to remove
     */
    removeEventListener(eventtype, callback){
        // Make sure eventtype is valid
        eventtype = this._validateEventType(eventtype);
        // If eventtype was invalid, it will now be null and we will fail silently
        if(!eventtype) return;

        let listeners = this._listeners[eventtype];
        // Get the index of the callback to remove it from the array
        let eventindex = listeners.indexOf(callback);

        // If the callback isn't in the array, we'll fail silently
        if(eventindex < 0) return;

        // Remove callback from listeners
        listeners.splice(eventindex, 1);
    }

    /**
     * Call all Callbacks for the given eventtype
     * @param {String | Symbol} eventtype - The eventtype which triggers the callback
     *                                  (either the stringname or the enumeration) 
     * @param {Object} additional - Additional properties to add to the Event Object
     */
    triggerEvent(eventtype, additional){
        eventtype = this._validateEventType(eventtype);
        let event = new Event(eventtype,
            {
                "combat": this,
                "player": this.player,
                "enemy":this.enemy,
                "time":UTILS.now()
            }
        );
        // If additional properties were passed, add them
        if(additional && typeof additional !== "undefined"){
            Event.assign(additional);
        }
        for(let listener of this._listeners[eventtype]){
            result = listener(event);
            // TODO: consider cancelling combat via listener
        }
    }

    /**
     * Handles the combat loop, which involves placing player actions
     * and enemy actions on the stack and resolving them while checking
     * for combat to end
     */
    combatLoop(){
        // Trigger startloop event
        this.triggerEvent(Combat.EVENTTYPES.startloop);

        // If combat is over, resolve combat and return
        if(this.victor !== null) return this.resolveCombat();
        
        let playerCommands = [], enemeyActions = [];

        playerCommands = [...this.playerQueue];

        // Clear playerQueue
        this.playerQueue = [];
        
        // Since we're modeling off of A Dark Room, the Enemey AI just spams
        // attack afaik. For more sophisticated gameplay we would implement an
        // actual AI
        // Use first fireable weapon
        let weapon = this.enemy.firstFireableWeapon();
        // If no weapon is immediately fireable, use the first available one instead
        weapon = weapon ? weapon : this.enemy.firstAvailableWeapon();
        // If the AI has a weapon it can use, use it
        if(weapon) enemeyActions.push(
            CharacterAction(this.enemy, actiontypes.WEAPON, weapon, this.player)
            );

        this.combatStack(playerCommands, enemeyActions);

        // Trigger endloop event
        this.triggerEvent(Combat.EVENTTYPES.endloop);

        // Set next timeout
        window.setTimeout(this.combatLoop, LOOPRATE);
    }

    /**
     * A cycle in the Combat Loop
     * @param {CharacterAction[]} playerCommands - An array of CharacterActions to execute
     */
    combatStack(playerCommands, enemyActions){
        // Trigger startstack event
        this.triggerEvent(Combat.EVENTTYPES.startstack, {playerCommands, enemyActions});

        // Handle all player commands and enemy actions
        for(let action of [...playerCommands, ...enemyActions]){
            if(action.actiontype === actiontypes.WEAPON) this.handleWeapon(action);
            else if(action.actiontype === actiontypes.ITEM) this.handleItem(action);

            // Update character states and exits the combatStack if the
            // combat is over
            /** DEVNOTE - Immediately exiting here has implications if we add DOT
             *              to the game and don't handle it before this point
             */
            if(this.handleKO()) return;

        }        
        // Update the state of all weapons
        // Putting this after all other handleKO()s because weapons don't matter
        // if combat is over
        this.player.updateWeapons();
        this.enemy.updateWeapons();

        // Trigger endstack event
        this.triggerEvent(Combat.EVENTTYPES.endstack);
    }

    /**
     * Uses the given weapon to deal damage to the target
     * @param {CharacterAction} action - The WEAPON CharacterAction to resolve
     */
    handleWeapon(action){
        let weapon = action.object;
        if(!weapon.isFireable()){
            // As usual, we should raise an error, but since we're being as simple as
            // possible, we'll just ignore the action
            if(!weapon.isAvailable()) return;
            // If the weapon is a warmup-type, then we will start charging it and exit
            if(weapon.weapontype.warmup){
                weapon.warmup = UTILS.now();
                return;
            }
        }
        // Weapon is fireable, so deal damage
        // Damage right now is weapondamage - armor, minimum of 1 damage
        action.opponent.statistics.currentHP -= Math.max(weapon.weapontype.damage - action.opponent.armor.value, 1);

        // Have weapon set itself as fired
        // We're allowing weapon to handle this itself incase using a weapon becomes
        // more complicated in the future
        weapon.fire();
    }

    /**
     * Call an itemtype's callback
     * @param {CharacterAction} action - The Item CharacterAction to resolve
     */
    handleItem(action){
        let item = action.object
        item.itemtype.callback(action.activator, action.opponent);
        // Similar to weapons, we're letting item do whatever it needs to do
        // in response to being used (instead of e.g.- removing a consumable)
        // item from the character
        item.use();
    }

    /**
     * Updates the Combat's victor attribute if either character is knocked out
     * and returns if victor has been set.
     * 
     * DEVNOTE- Because we're keeping it simple, this is the only Terminating State
     *          for combat. Normally, we'd call this checkCombatResolution or something
     *          similar and check for multiple states that end combat.
     * @returns {Boolean} - A boolean indicating wether player or enemy has been KO'd
     */
    handleKO(){
        if(this.player.isKOd()) this.victor = this.enemy;
        else if(this.enemy.isKOd()) this.victor = this.player;
        if(this.victor !== null) return true;
        return false;
    }
}
