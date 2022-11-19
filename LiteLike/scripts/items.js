"use strict";

import { Character } from "./character.js";
import * as UTILS from "./utils.js";

// Weapon Ranges
export const weaponranges = UTILS.enumerate("MELEE", "RANGED", "LASER");

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
     * @param {Item} ammunition - If this is a projectile-type weapon, the item id for its ammunition
     */
    constructor(id, damage, cooldown, warmup, range, weight, ammunition){
        super();
        this.id = id;
        this.damage = damage;
        this.cooldown = cooldown;
        this.warmup = warmup;
        this.range = range;
        this.weight = weight;
        this.ammunition = ammunition
    }

    
    get requiresAmmunition(){
        return this.ammunition && typeof this.ammunition !== "undefined";
    }
    
}

/**
 * A specific instance of a WeaponType
 * 
 * Session 20 Update: all weapons are now charging weapons.
 *   The rationale is that melee weapons and projectile weapon's animation
 *   time can be linked to the charge timer. "Traditional" charging weapons
 *   are intended to be animated differently. It's possible that an additional
 *   weapontype attribute should be added to distinguish animation style.
 * Weapons have 4 states:
 *  On Cooldown: this.cooldown is not Ready, this.warmup is frozen and not ready
 *  Pre Charging - this.cooldown is ready, this.warmup is frozen and not ready
 *  Charging- this.cooldown is ready, this.warmup is not frozen and not ready
 *  Charged (fireable)- this.cooldown is ready, this.warmup is frozen and is ready
 * 
 * Firing process:
 *  Check if cooldown is ready-> If not it is not available
 *  Make sure warmup is frozen and not ready -> If it is not frozen then it's charing
 *                                           -> If it's ready, then it's fireable
 *  unfreeze warmup -> Weapon begins charging
 *  when warmup is ready -> weapon is fireable
 *  
 */
export class Weapon {
    /**
     * 
     * @param {WeaponType} weapontype - This weapon's WeaponType, which determines its base statistics
     */
    constructor(weapontype){
        this.weapontype = weapontype;
        let now = UTILS.now();
        this.cooldown = new UTILS.Timer(now, this.weapontype.cooldown, true);
        this.warmup = new UTILS.Timer(now, this.weapontype.warmup, true);
    }

    /**
     * Returns a new copy of the object
     */
    new(){
        return new Weapon(this.weapontype);
    }

    /**
     * Returns the weapontype; useful when we're treating the weapon
     * as a generic "item"
     */
    get type(){ return this.weapontype; }

    /**
     * Returns whether the weapon is available to used
     * 
     * @param {Character} character - The character using the weapon; necessary if the weapon has ammunition 
     */
    isAvailable(character){
        // The weapon is not on cooldown or charging
        return this.cooldown.isReady && this.warmup.isFrozen && !this.warmup.isReady &&
        // If weapon has ammunition, check that character has the required ammunition
        !this.missingAmmunition(character);
    }

    /**
     * Returns whether the weapon is ready to fire
     * 
     * @param {Character} character - The character firing the weapon; necessary if the weapon has ammunition 
     */
     isFireable(character){
        // Not on cooldown and not a warmup weapon or
        // Chargeable weapon only has a ready warmup when it's ready to fire
        return this.cooldown.isReady && this.warmup.isReady &&
        // If weapon has ammunition, check that character has the required ammunition
        !this.missingAmmunition(character);
    }

    /**
     * Returns whether the weapon is currently charging up.
     * If the weapon is not a chargeable type to begin with, this will always
     * return false
     */
    isCharging(){
        // Weapon's warmup is only unfrozen when it's charging
        return !this.warmup.isFrozen
    }

    /**
     * Checks whether the weapon needs ammunition which the character does not have
     * @param {Character} character - The character using the weapon
     */
    missingAmmunition(character){
        return this.weapontype.requiresAmmunition && !character.getResource(this.weapontype.ammunition);
    }

    /**
     * Updates the weapon's cooldown and warmup after it is fired
     * 
     * @param {Character} character - The character firing the weapon; necessary if the weapon has ammunition 
     */
    fire(character){
        // Can't fire weapon that is not fireable
        if(!this.isFireable(character)) return;

        // Start the cooldown timer on a new cycle
        this.cooldown.clearReady();
        this.cooldown.unfreeze();

        // Clear the warmup ready flag (don't unfreeze)
        this.warmup.clearReady();

        // Subtract ammunition if we need it
        if(this.weapontype.requiresAmmunition){
            let resource = character.getResource(this.weapontype.ammunition);
            // This is an error if it happens, but we aren't handling errors right now
            // DEVNOTE- That makes this a potential exploit
            if(!resource) return;
            resource.quantity -= 1;
        }
    }

    /**
     * Calls updateCycles on cooldown and warmup (if it exists)
     * @param {Number} now - The update time for the timers
     */
    updateTimers(now){
        this.cooldown.updateCycles(now);
        this.warmup.updateCycles(now);
    }

    /**
     * Set's the weapon's cooldown to Ready and the warmup (if it has one) to the frozen and unready state
     */
    clearState(){
        // Make sure both are frozen
        if(!this.cooldown.isFrozen) this.warmup.freeze();
        if(!this.warmup.isFrozen) this.warmup.freeze();

        // Set cooldown to ready
        this.cooldown.setReady();
        // Set warmup to not ready
        this.warmup.clearReady();
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
        this.cooldown = new UTILS.Timer(UTILS.now(), this.itemtype.cooldown, true);
    }

    /**
     * Returns a new copy of the Item. If qty is provided, the copy will have
     * the corresponding quantity instead.
     * @param {Number} qty - If provided, the quantity the copy should have. Otherwise,
     *      the copy will have the same quantity as the original
     * @returns {Item} - A copy of the Item
     */
    new(qty){
        if(typeof qty == "undefined") qty = this.quantity;
        return new Item(this.itemtype, qty);
    }

    /**
     * Returns the itemtype; useful when we're treating the item
     * as a generic "item"
     */
     get type(){ return this.itemtype; }

    /**
     * Reduces the Item's quantity by one (min 0) and begins the cooldown timer
     */
    use(){
        // If this item is consumable, remove a quantity (min. 0 after removing)
        if(this.itemtype.isConsumable) this.quantity = Math.max(this.quantity - 1, 0);

        // Begin cooldown
        this.cooldown.clearReady();
        this.cooldown.unfreeze();
    }

    /**
     * Updates the cooldown timer
     * @param {Number} now - performance.now
     */
    updateTimer(now){
        this.cooldown.updateCycles(now);
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
    
    /**
     * Returns a new copy of the Resource. If qty is provided, the copy will have
     * the corresponding quantity instead.
     * @param {Number} qty - If provided, the quantity the copy should have. Otherwise,
     *      the copy will have the same quantity as the original
     * @returns {Resource} - A copy of the Resource
     */
    new(qty){
        if(typeof qty == "undefined") qty = this.quantity;
        return new Resource(this.resourcetype, qty);
    }

    /**
     * Returns the resourcetype; useful when we're treating the resource
     * as a generic "item"
     */
     get type(){ return this.resourcetype; }
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

    /**
     * Sets the Transport's reactorPower to maxReactorPower
     */
    topOff(){
        this.reactorPower = this.maxReactorPower;
    }

}