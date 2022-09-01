"use strict";

import * as UTILS from "./utils.js";

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
     * @param {Symbol} actiontype - an actiontype
     * @param {Weapon | Item} object - the item or weapon being used
     */
    constructor(actiontype, object){
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
    }
    /**
     * A cycle in the Combat Loop
     * @param {PlayerAction[]} playercommands - An array of PlayerActions to execute
     */
    combatStack(playercommands){

        // Handle all player commands since last cycle
        for(let action of playercommands){
            if(action.actiontype === actiontypes.WEAPON) this.handleWeapon(action.object, this.player, this.enemy);
            else if(action.actiontype === actiontypes.ITEM) this.handleItem(action.object);

            // Update character states and exits the combatStack if the
            // combat is over
            /** DEVNOTE - Immediately exiting here has implications if we add DOT
             *              to the game and don't handle it before this point
             */
            if(this.handleKO()) return;

        }
        // Since we're modeling off of A Dark Room, the Enemey AI just spams
        // attack afaik. For more sophisticated gameplay we would implement an
        // actual AI
        // Use first fireable weapon
        let weapon = this.enemy.firstFireableWeapon();
        // If no weapon is immediately fireable, use the first available one instead
        weapon = weapon ? weapon : this.enemy.firstAvailableWeapon();
        // If the AI has a weapon it can use, use it
        if(weapon) this.handleWeapon(weapon, this.enemy, this.player)

        //Se above notes
        if(this.handleKO()) return;
        
        // Update the state of all weapons
        // Putting this after all other handleKO()s because weapons don't matter
        // if combat is over
        this.player.updateWeapons();
        this.enemy.updateWeapons();
    }

    /**
     * Uses the given weapon to deal damage to the target
     * @param {Weapon} weapon - The weapon instance being used
     * @param {Character} activator - The Character weilding the weapon
     * @param {Character} target - The Characte being targeted by the weapon
     */
    handleWeapon(weapon, activator, target){
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
        target.statistics.currentHP -= max(weapon.weapontype.damage - target.armor.value, 1);

        // Have weapon set itself as fired
        // We're allowing weapon to handle this itself incase using a weapon becomes
        // more complicated in the future
        weapon.fire();
    }

    /**
     * Call an itemtype's callback
     * @param {Item} item - The item being used
     * @param {Character} activator - The character using the item
     * @param {Character} opponent - The opposing character
     */
    handleItem(item, activator, opponent){
        item.itemtype.callback(activator, opponent);
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
