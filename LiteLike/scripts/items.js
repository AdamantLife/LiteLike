"use strict";

import * as UTILS from "./utils.js";

// Weapon Ranges
export const weaponranges = UTILS.enumerate("MELEE", "RANGED");

// State of the weapon based on Warmup and Cooldown
export const weaponstates = UTILS.enumerate(
    "CHARGING", // The weapon is warming up
    "CHARGED", // The weapon was previously Charged and now is ready to deal damage
    "FIRED", // The Weapon was previously Ready, Charged, or Charging and now needs its Cooldown updated
    "READY" // The Weapon is off of cooldown and off of warmup
    );

/** TODO: Update Cooldowns to Timers */

/**
 * A superclass for stackable items (items with quantities) and have weight
 */
class Stackable {
    /**
     * 
     * @param {Number} quantity - The quantity in this stack
     * @param {*} weight - The weight per item
     */
    constructor(quantity, weight){
        this.quantity = quantity;
        this.weight = weight;
    }

    get totalWeight(){
        return this.quantity * this.weight;
    }
}

/**
 * A Supperclass for *Types which can be purchased in the shop
 */
class ShopItem {
    /**
     * 
     * @param {Symbol[] | undefined} shopPrerequisites - Unlocks required to purchase from shop
     * @param {Resource[]} shopCost - Cost to 
     */
    constructor(shopPrerequisites, shopCost){
        this.shopPrerequisites = shopPrerequisites;
        this.shopCost = shopCost;
    }
}

/**
 * A class for describing attack options
 */
export class WeaponType extends ShopItem{
    /**
     * 
     * @param {Number} id - An integer
     * @param {Number} damage - An integer amount of damage the weapon deals
     * @param {Number} cooldown - A float representing the amount of time the interval
     *                              required between uses in ms
     * @param {Number} warmup - A float representing how long a weapon takes to inflict damage
     *                      after it has been activated
     * @param {Symbol} range - The range of the weapon from weaponranges
     * @param {Number} weight - how much a single qty weighs (contributes to the Transport's Capacity)
     */
    constructor(id, damage, cooldown, warmup, range, weight){
        super();
        this.id = id;
        this.damage = damage;
        this.cooldown = cooldown;
        this.warmup = warmup;
        this.range = range;
        this.weight = weight;
    }
}

/**
 * A specific instance of a WeaponType
 * 
 * TODO: Add Ammuniton-Type Weapons
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
        // The weapon is not on cooldown or charging
        return this.cooldown === weaponstates.READY && this.warmup === weaponstates.READY;
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
     * Returns whether the weapon is currently charging up.
     * If the weapon is not a chargeable type to begin with, this will always
     * return false
     */
    isCharging(){
        // Weapon is not chargeable to begin with
        if(!this.weapontype.warmup) return false;
        // The weapon is charging if it's warmup is not in a defined state
        // i.e.- it is a float representing a time
        return Object.values(weaponstates.hasOwnProperty).indexOf(this.warmup) == -1;
    }

    /**
     * Updates the weapon's cooldown and warmup after it is fired
     */
    fire(){
        this.cooldown = UTILS.now();
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

        // Makesure that the weapon is actually charging
        if(!this.isCharging()) return Infinity;

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
export class Armor extends ShopItem{

    /**
     * @param {Number} id - an unique integer
     * @param {Number} value - Amount of damage the armor prevents
     */
    constructor(id, value){
        super();
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
export class ItemType extends ShopItem{

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
     * @param {Number} weight - how much a single qty weighs (contributes to the Transport's Capacity)
     */
    constructor(id, target, callback, isConsumable, cooldown, weight){
        super();
        this.id = id;
        this.target = target;
        this.callback = callback;
        this.isConsumable = Boolean(isConsumable);
        this.cooldown = cooldown;
        this.weight = weight;
    }
}

/**
 * The instance-class of an ItemType
 */
export class Item extends Stackable{
    /**
     * 
     * @param {ItemType} itemtype - The itemtype this item instance represents
     * @param {Number} quantity - The number of items in the stack.
     */
    constructor(itemtype, quantity){
        super(quantity, itemtype.weight);
        this.itemtype = itemtype
        this.cooldown = null;
    }

    use(){
        // If this item is consumable, remove a quantity (min. 0 after removing)
        if(this.itemtype.isConsumable) this.quantity = Math.max(this.quantity - 1, 0);
    }
}

/**
 * Base class for Resources
 */
export class ResourceType extends ShopItem{
    /**
     * 
     * @param {Number} id - A unique identifier for this ResourceType
     * @param {Number} weight - The weight per resourceType
     */
    constructor(id, weight){
        super();
        this.id = id;
        this.weight = weight;
    }
}

/**
 * The instance-class of an ResourceType
 */
export class Resource extends Stackable{
    /**
     * 
     * @param {ResourceType} resourcetype - The resource type this item represents
     * @param {Number} quantity - The number of resources in the stack
     */
    constructor(resourcetype, quantity){
        super(quantity, resourcetype.weight);
        this.resourcetype = resourcetype;
    }
}

/**
 * Transport is our version of Wagon from A Dark Room
 * Translations from ADR:
 *      - reactorPower => Water (maxReactorPower)
 *      - capacity => capacity
 */
export class Transport extends ShopItem{
    /**
     * 
     * @param {Number} id - A Unique identifier
     * @param {Number} reactorPower- The amount of reactorPower the Transport currently has
     * @param {Number} maxReactorPower - The amount of power the Transport can hold (refills at TheColony)
     * @param {Number} capacity - The amount weight (for items and weapons)
     */
    constructor(id, reactorPower, maxReactorPower, capacity){
        super();
        this.id = id;
        this.reactorPower = reactorPower;
        this.maxReactorPower = maxReactorPower;
        this.capacity = capacity;
        // The transport is topped off by default
        this.reactorPower = this.maxReactorPower;
    }

}