"use strict";

import * as UTILS from "./utils.js";

// Weapon Ranges
const weaponranges = UTILS.enumerate("MELEE", "RANGED");

// State of the weapon based on Warmup and Cooldown
const weaponstates = UTILS.enumerate(
    "CHARGING", // The weapon is warming up
    "CHARGED", // The weapon was previously Charged and now is ready to deal damage
    "FIRED", // The Weapon was previously Ready, Charged, or Charging and now needs its Cooldown updated
    "READY" // The Weapon is off of cooldown and off of warmup
    );

/**
 * A class for describing attack options
 */
export class WeaponType{
    /**
     * 
     * @param {Number} id - An integer
     * @param {Number} damage - An integer amount of damage the weapon deals
     * @param {Number} cooldown - A float representing the amount of time the interval
     *                              required between uses in ms
     * @param {Number} warmup - A float representing how long a weapon takes to inflict damage
     *                      after it has been activated
     * @param {Symbol} range - The range of the weapon from weaponranges
     */
    constructor(id, damage, cooldown, warmup, range){
        this.id = id;
        this.damage = damage;
        this.cooldown = cooldown;
        this.warmup = warmup;
        this.range = range;
    }
}

/**
 * A specific instance of a WeaponType
 */
export class Weapon {
    /**
     * 
     * @param {WeaponType} weapontype - This weapon's WeaponType, which determines its base statistics
     */
    constructor(weapontype){
        this.weapontype = weapontype;
        this.cooldown = weaponstates.READY;
        this.warmup = weaponstates.READY;
    }

    /**
     * Returns whether the weapon is available to used
     */
    isAvailable(){
        // The weapon is not on cooldown
        return this.cooldown === weaponstates.READY;
    }

    /**
     * Returns whether the weapon is ready to fire
     */
     isFireable(){
        // The weapon does not have a warmup is not on cooldown
        return (!this.weapontype.warmup && this.cooldown === weaponstates.READY) ||
        // or its warmup is complete
        this.warmup === weaponstates.CHARGED;
    }

    /**
     * Updates the weapon's cooldown and warmup after it is fired
     */
    fire(){
        this.cooldown = now();
        if(this.weapontype.warmup) this.warmup = weaponstates.FIRED;
    }

    /**
     * Updates cooldown and warmup states
     */
    updateState(){
        let now = UTILS.now();
        // If this.cooldown is not null, check if we can reset it
        if(this.cooldown !== weaponstates.READY){
            // If the difference between now and when the weapon cooldown was timestamped
            // is longer than the weapontype's cooldown, we are no longer on cooldown
            if((now - this.cooldown) > this.weapontype.cooldown) this.cooldown = weaponstates.READY;
        }

        // If this.warmup is not Ready, we may need to update it
        if(this.warmup !== weaponstates.READY){
            // The weapon was previously in the CHARGED state and has since been fired
            // This check is relatively redundant with this.fire by design as
            // we may change the charging mechanic in the future
            if(this.warmup === weaponstates.FIRED){
                this.warmup = weaponstates.READY;
            }
            // Warmup is not Ready or Fired, which leaves only CHARGED or a now()
            // If it's not CHARGED, Weapon warmup timer has been started
            else if(this.warmup !== weaponstates.CHARGED){
                // Weapon is done warming up
                if(this.warmupRemaining(now) <= 0) this.warmup = weaponstates.CHARGED;
            }
        }
    }

    /**
     * Returns the difference between base warmup time and the time
     * which has elapsed since warmup has started
     * @param {Number} now - The current UTILS.now() result (ms since page load)
     * @returns {Number | Infinity} - The amount of Warmup time remaining (in ms).
     *                                  Infinity if the weapon is not warming up or can't warm up
     */
    warmupRemaining(now){
        // For these first two checks, we might normally raise an error, but
        // we're keeping it simple, so we'll just return Infinity

        // Check that this weapon is actually a chargeable weapon
        if(!this.weapontype.warmup) return Infinity;

        // Check if this.warmup is a weaponstate
        if(weaponstates.indexOf(this.warmup) > -1) return Infinity;

        // If now is not supplied, call it ourselves
        // I'm doing this second since it costs more to call now() than to check
        // this.warmup
        if(typeof now === "undefined" || now === null) now = UTILS.now();

        // Return the difference
        return this.weapontype.warmup - (now - this.warmup);
    }

    /**
     * Resets the weapon's cooldown and warmup values
     */
    clearState(){
        this.cooldown = weaponstates.READY;
        this.warmup = weaponstates.READY;
    }
}

/**
 * Base class for Armor
 * Currently Armor is very simple damage reduction with no abilities;
 * if this changes in the future we can split armor into ArmorType/Armor
 * like with Weapons
 */
export class Armor {

    /**
     * @param {Number} id - an unique integer
     * @param {Number} value - Amount of damage the armor prevents
     */
    constructor(id, value){
        this.id = id;
        this.value = value;
    }
}

// NOTE- Combat is 1-on-1 and items can't target other equipment
//          In a more complete game we could add things like "MULTIPLE" or "ITEM"
const targets = UTILS.enumerate("SELF", "ENEMY");

/**
 * Base class for Items
 */
export class ItemType{

    /**
     * DEVNOTE- In a more-complex game isConsumable would be "maxUses", but A Dark Room
     *          only has 1-use items
     * 
     * @param {Number} id - An unique Number
     * @param {Symbol} target - An enumerated value from targets representing what
     *                          the target for the item is
     * @param {combatCallback} callback - A function which handles the item's
     *                          effect. Should accept an activator and activator's
     *                          opponent as its first two arguments
     * @param {Boolean} isConsumable - A boolean indicating whether the item instance
     *                              should be destroyed upon use.
     * @param {Number | null} cooldown - A cooldown that must elapse between uses
     */
    constructor(id, target, callback, isConsumable, cooldown){
        this.id = id;
        this.target = target;
        this.callback = callback;
        this.isConsumable = bool(isConsumable);
        this.cooldown = cooldown;
    }
}

/**
 * The instance-class of an ItemType
 */
export class Item{
    /**
     * 
     * @param {ItemType} itemtype - The itemtype this item instance represents
     * @param {Number} quantity - The number of items in the stack.
     */
    constructor(itemtype, quantity){
        this.itemtype = itemtype
        this.quantity = quantity
        this.cooldown = null;
    }

    use(){
        // If this item is consumable, remove a quantity (min. 0 after removing)
        if(this.itemtype.isConsumable) this.quantity = max(this.quantity - 1, 0);
    }
}