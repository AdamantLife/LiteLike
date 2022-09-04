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

const actiontypes = UTILS.enumerate(["WEAPON","ITEM"])

class PlayerAction{
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
class Combat{
    /**
     * 
     * @param {Character} player - The Player Character
     * @param {Character} enemy - The Enemy Character
     */
    constructor(player, enemy){
        this.player = player;
        this.enemy = enemy;
        this.victor = null;
        this.playerQueue = [];
        this.playerDistance = weaponranges.RANGED;
        this.enemyDistance = weaponranges.RANGED;
    }

    /**
     * Handles the combat loop, which involves placing player actions
     * and enemy actions on the stack and resolving them while checking
     * for combat to end
     */
    combatLoop(){
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
            PlayerAction(this.enemy, actiontypes.WEAPON, weapon, this.player)
            );

        this.combatStack(playerCommands, enemeyActions);
        window.setTimeout(this.combatLoop, LOOPRATE);
    }

    /**
     * A cycle in the Combat Loop
     * @param {PlayerAction[]} playerCommands - An array of PlayerActions to execute
     */
    combatStack(playerCommands, enemyActions){

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
    }

    /**
     * Uses the given weapon to deal damage to the target
     * @param {PlayerAction} action - The WEAPON PlayerAction to resolve
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
     * @param {PlayerAction} action - The Item PlayerAction to resolve
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
