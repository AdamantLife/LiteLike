"use strict";

import * as UTILS from "./utils.js";
import {weaponranges} from "./items.js";

// This is a post-combat time period (in ms) where the
// player can still activate items before combat is over
const LOCKOUT = 1500;

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

export const actiontypes = UTILS.enumerate("WEAPON","ITEM");

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
export class Combat extends UTILS.EventListener{
    static EVENTTYPES = UTILS.enumerate("startloop","endloop","startstack","endstack","useweapon", "useitem", "endcombat", "characterko");

    /**
     * 
     * @param {Character} player - The Player Character
     * @param {Character} enemy - The Enemy Character
     */
    constructor(player, enemy){
        super(Combat.EVENTTYPES);
        this.player = player;
        this.enemy = enemy;
        this.victor = null;
        this.starttime = UTILS.now();
        this.playerQueue = [];
        this.playerDistance = weaponranges.RANGED;
        this.enemyDistance = weaponranges.RANGED;
        // This is a post-combat time period where the
        // player can still activate items before combat is over
        this.lockout = false;
    }

    getDefaultEventData(){
        return {
            "combat": this,
            "player": this.player,
            "enemy":this.enemy,
            "time":UTILS.now()
        };
    }

    prepareCombat(){
        let now = UTILS.now();
        // For each weapon in combat
        for(let weapon of [...this.player.weapons, ...this.enemy.weapons]){
            // For each Timer reset it with Now, then freeze it
            weapon.cooldown.reset(now);
            weapon.cooldown.freeze();
            // For Cooldown, make sure it's ready
            weapon.cooldown.setReady();

            // Do the same for warmup
            weapon.warmup.reset(now);
            weapon.warmup.freeze();
            // For warmup, make sure it's not ready
            weapon.warmup.clearReady();
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

        // Player has lost, so end combat
        if(this.victor == this.enemy) return this.resolveCombat();

        // Player has won and lockout time is over
        if(this.victor == this.player & this.lockout <= UTILS.now()) return this.resolveCombat();
        
        let playerCommands = [], enemyActions = [];

        playerCommands = [...this.playerQueue];

        // Clear playerQueue
        this.playerQueue = [];
        
        // Enemy is dead, so it can't take new actions
        if(!this.lockout){
            this.getEnemyAction(enemyActions);
        }else{
            // But if it fired a projectile weapon, that projectile will still hit the player
            // DEV NOTE: Besides being logical, this is also how A Dark Room functioned
            for(let weapon of this.enemy.weapons){
                // Weapon has to be ranged and its warmup has to be ready
                if(weaponranges[weapon.weapontype.range] == weaponranges.RANGED && weapon.warmup.isReady){
                    // Add the weapon action
                    enemyActions.push(new CharacterAction(this.enemy, actiontypes.WEAPON, weapon, this.player));
                }
            }
        }

        this.getCharged(playerCommands, enemyActions);

        this.combatStack(playerCommands, enemyActions);

        // Update the weapons and items cycles
        let now = UTILS.now();
        this.player.updateWeapons(now);
        this.player.updateItems(now);
        this.enemy.updateWeapons(now);
        this.enemy.updateItems(now);

        // Trigger endloop event
        this.triggerEvent(Combat.EVENTTYPES.endloop);

        // Set next timeout
        window.setTimeout(this.combatLoop.bind(this), UTILS.LOOPRATE);
    }

    /**
     * In theory, we could handle different enemy AI's here
     * However, since we're modeling off of A Dark Room, the Enemey AI just spams
     * attack afaik.
     * @param {CharacterAction[]} enemyActions - The enemy actions array
     */
    getEnemyAction(enemyActions){
        // Get first available weapon
        let weapon = this.enemy.firstAvailableWeapon();
        // If the AI has a weapon it can use, use it
        if(weapon) enemyActions.push(
            new CharacterAction(this.enemy, actiontypes.WEAPON, weapon, this.player)
            );
    }

    /**
     * For both the player and the enemy, check if any weapons are fully charged and ready to fire
     * and add them to the action arrays if they are
     * @param {CharacterAction[]} playerCommands - The list of player commands to which Player Weapons that are fully charged will be added
     * @param {CharacterAction[]} enemyActions - The list of enemy actions to which the enemy's charged weapons will be added
     */
    getCharged(playerCommands, enemyActions){
        for(let weapon of this.player.weapons){
            if(weapon.isFireable(this.player)) playerCommands.push(new CharacterAction(this.player, actiontypes.WEAPON, weapon, this.enemy));
        }
        for(let weapon of this.enemy.weapons){
            if(weapon.isFireable(this.enemy)) enemyActions.push(new CharacterAction(this.enemy, actiontypes.WEAPON, weapon, this.player));
        }
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

        // Trigger endstack event
        this.triggerEvent(Combat.EVENTTYPES.endstack);
    }

    /**
     * Uses the given weapon to deal damage to the target
     * @param {CharacterAction} action - The WEAPON CharacterAction to resolve
     */
    handleWeapon(action){
        let weapon = action.object;
        if(!weapon.isFireable(action.activator)){
            // If the weapon is a warmup-type, then we will start charging it
            // if it is ready to be charged
            if(weapon.warmup && weapon.warmup.isFrozen){
                weapon.warmup.unfreeze();
                // Notify listeners that the weapon's warmup is being updated
                this.triggerEvent(Combat.EVENTTYPES.useweapon, {action, result: "warmup", damage: null});
                return;
            }
            // If the weapon was not fireable, and cannot start the charging cycle
            // then it was invalid and in theory we should throw an error, but as
            // noted elsewhere, we aren't raising errors to keep the game simple
            return;
        }

        // Weapon is fireable, so deal damage
        // Damage right now is weapondamage - armor, minimum of 1 damage
        let damage = Math.max(weapon.weapontype.damage - action.opponent.armor.value, 1);

        // let listeners know the weapon is about to deal damage
        // As with, triggerEvent in theory we could allow the listeners to modify combat
        // (which is why we are saving the result) but that is probably outside of the
        // scope of this game
        // DEVNOTE- We could/should also implement before/after damage events, but- again- probably uneccesary at the moment
        let result = this.triggerEvent(Combat.EVENTTYPES.useweapon, {action, result: "damage", damage});
        
        // Apply the damage to the opponent
        action.opponent.adjustHP(-damage);

        // Have weapon set itself as fired
        // We're allowing weapon to handle this itself incase using a weapon becomes
        // more complicated in the future
        weapon.fire(action.activator);
    }

    /**
     * Call an itemtype's callback
     * @param {CharacterAction} action - The Item CharacterAction to resolve
     */
    handleItem(action){
        let item = action.object

        // Activate the item
        item.itemtype.callback(action.activator, action.opponent);
        // Similar to weapons, we're letting item do whatever it needs to do
        // in response to being used (instead of e.g.- removing a consumable)
        // item from the character
        item.use();

        // Notify listeners that an item has been used
        // DEVNOTE- As noted in handleWeapon, it would probably be useful to implement
        // before and after useitem events as well
        this.triggerEvent(Combat.EVENTTYPES.useitem, {action, item});
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
        let ko = null;
        if(this.player.isKOd()){
            this.victor = this.enemy;
            ko = this.player;
        }
        else if(this.enemy.isKOd()){
            this.victor = this.player;
            ko = this.enemy;
            // Start lockout time where the player can still act
            // even though combat is over
            this.lockout = UTILS.now() + LOCKOUT;
        }
        if(this.victor !== null){
            // Notify listeners that a character has been ko'd
            this.triggerEvent(Combat.EVENTTYPES.characterko, {character: ko});
            return true;
        }
        return false;
    }

    /**
     * Cleans up combat
     */
    resolveCombat(){
        // Notify listeners of end of combat
        this.triggerEvent(Combat.EVENTTYPES.endcombat);
        //TODO
    }
}
