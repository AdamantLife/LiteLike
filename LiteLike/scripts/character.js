"use strict";

import * as UTILS from "./utils.js";
import {Equipment, Resource} from "./items.js";

export const roles = UTILS.enumerate("PLAYER", "ENEMY", "CHARACTER", "ITEM");

export const CHARAWEAPONLOADOUT = 5;
export const CHARAITEMLOADOUT = 3;

/**
 * An individual entity within the game
 */
class Entity extends UTILS.EventListener{
    /**
     * Initializes a new Entity
     * @param {Number} id - The enumerated id of this specific Entity
     * @param {Symbol[]} roles - A list of roles to add to this Entity on creation
     */
    constructor(events,id, roles){
        super(events);
        this.id = id;
        this._roles = [];
        for(let role of roles)this.addRole(role);
    }
    
    /**
     * Adds a role to the entity if the role does not already exist
     * @param {Symbol} role - Adds a new role to the Entity
     */
    addRole(role){
        if(this._roles.indexOf(role) < 0) this._roles.push(role);
    }

    get roles(){
        return this._roles;
    }
}

/**
 * A workaround to implment multiple inheritances for Characters 
 * which should extend both Entity and EventListener
 */
export class Character extends Entity{
    static EVENTTYPES = UTILS.enumerate("equipmentchange", "inventorychange",
    "weaponchange", "weaponremoved", "weaponadded",
    "itemschange", "itemadded", "itemremoved",
    "resourceschange",
    "hpchange", "currentHPchange");

    /**
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Game} game - The Game Object the Character belongs to
     */
    constructor(id, roles, game){
        super(Character.EVENTTYPES, id, roles);
        this.game = game
    }

    /**
     * ALl character events should return the given data at minimum
     * @returns {Object} - The default event data
     */
    getDefaultEventData(){
        // Just in case Character changes in the future, make sure we're getting all parent data
        let base = super.getDefaultEventData();
        // Update with the data we want
        Object.assign(base, {character: this})
        // Return the base (which has been updated in place)
        return base;
    }

    /**
     * Given a weapon id, return the index of the first weapon with that id.
     * Return -1 if a matching weapon is not found
     * @param {Number} weapon - The weapon id to get
     * @returns {Number | -1} - The index of the matching weapon, or -1 if player doesn't have that weapontype
     */
    getWeaponIndex(weapon){
        // Iterate over all weapons
        let weap;
        for(let i = 0; i < this.weapons.length; i++){
            weap = this.weapons[i]
            // A weapon exists at this index
            if(weap && typeof weap !== "undefined"
                // and its weapontype id matches what we are looking for
                && weap.weapontype.id  == weapon) return i;
        }

        // We didn't match, so return -1
        return -1;
    }

    /**
     * Returns the first weapon with the given weapon id, or null if none are found
     * @param {Number} weapon - The weapon id to get
     * @param {Boolean} [reverse=false] - if True, return the last weapon with id instead
     * @returns {Weapon | null} - Returns the weapon if they player has it, otherwise none
     */
    getWeapon(weapon, reverse = false){
        // Iterate over weapons
        for(let i = 0; i < this.weapons.length; i++){
            let index  = i;
            if(reverse) index = this.weapons.length - 1 - i;
            // If weapon id matches, return it
            if (this.weapons[index].weapontype.id == weapon){
                return this.weapons[index];
            }
        }
        // Null will be returned implicitly
    }

    /**
     * Returns the index of the item with the given item id in the player's equipment
     * @param {Number} item - The Item id
     * @returns {Number} - Returns the equipment index of the item, or -1 if the player does not possess the item
     */
    getItemIndex(item){
        // Iterate over items to find the item
        for(let i = 0; i < this.items.length; i++){
            let slot = this.items[i];
            // Nothing at that index, so skip it
            if(!slot || typeof slot == "undefined") continue;
            // Check if itemid is the one we're looking for
            // Return the current index if it is
            if(slot.itemtype.id == item) return i;
        }

        // Item not found, so return -1
        return -1;
    }

    /**
     * Checks the character's items list for the given item and returns it if the character has it
     * @param {Number} item - The item id to get
     * @param {Boolean} returnEmpty - A boolean to indicating whether to return an empty item
     * @returns {Item | null} - Returns the item if the player has it in non-zero quantity, otherwise null
     */
    getItem(item, returnEmpty = false){
        // Items are unsorted, so we'll have to dig through the whole backpack
        for(let it of this.items){
            // Empty slot (in loadout)
            if(!it || typeof it == 'undefined') continue;
            // If itemtype matches, return the Item Instance
            if(it.itemtype.id == item){
                // If returnEmpty is false and we don't have any
                // return null instead of the  item
                if(it.quantity <= 0 && !returnEmpty) return null;
                // Return the item
                return it;
            }
        }
        // We didn't find it, so if we don't have to return an empty Instance, return null
        if(!returnEmpty) return null;
        // Otherwise we need to create the instance
        return this.game.createEquipmentInstance("Item", item, 0);
    }

    /**
     * Returns the given resource if the Player has a positive quantity of it
     * @param {Number} resource - The resource ID to return
     * @param {Boolean} [returnEmpty=false] - A boolean to indicating whether to return an empty resource Instance.
     *                                          If false, returns null when the resource has no quantity.
     * @returns {Resource | null} - Either a Resource Instance (if the Player has a positive quantity, or if returnEmpty is true)
     *                                  otherwise null (no quantity and returnEmpty is false)
     */
    getResource(resource, returnEmpty = false){
        // Resources are sorted, so we can just get the corresponding index
        let r = this.resources[resource];
        // If the resources is not in our resources array, return null
        // Also return null if we don't have any quantity of the resource and we're not supposed to returnEmpty
        if( (!r || typeof r == "undefined" || r.quantity <= 0) && !returnEmpty) return null;

        // If r is null or undefined (which means that returnEmpty is true) convert it to an Instance with quantity 0
        if(!r || typeof r == "undefined") r = this.game.createEquipmentInstance("Resource", resource, 0);
        return r;
    }

    /**
     * Adds an item to the Character's equipment. If the character already
     * has the item, increases its quantity instead
     * @param {Item} item - The item to be added
     * @param {index} [index=undefined] - If the item is not already in the Character's
     *      equipment, the item will be inserted at the given index
     * @returns {[Item, Number]} - Returns the item as it exists on the character as the
     *      first element. If the item was moved, the second element will be the previous
     *      index of the element.
     */
    addItem(item, index=undefined){
        // NOTE- we're getting the index first because getItem(id, returnEmpty = true)
        //  can't distinguish between Quantity 0 and Undefined
        let previousIndex = this.getItemIndex(item.itemtype.id);
        let existing = null;
        if(previousIndex>=0){
            // Get Item from Index
            existing = this.items[previousIndex];
        } else{
            // If no previous index (-1), just set it to null instead
            previousIndex = null;
        }
        // If index provided and in loadout but we already have the
        // item in our inventory, we need to take it out in order to
        // put it in the right place
        if(existing && typeof index !== 'undefined'){
            // Remove
            this.removeItem(undefined, existing);
            // Add existing qty to item qty
            item.quantity += existing.quantity;
            // Item no longer exists in our items bag
            existing = false;
        }
        
        // If the item is not (now) in our item bag, we'll go about adding it
        if(!existing){
            // If index is provided, insert the item at that index
            if(typeof index !== "undefined"){
                this.items.insert(index, item);
            }
            // Otherwise, push the item into the equipment
            else this.items.push(item);
            return [item, previousIndex];
        }
        // Otherwise, we need to update our item
        existing.quantity += item.quantity;
        return [existing, previousIndex];
    }

    /**
     * Adds a resource to the Character's equipment. If the character already
     * has the resource, increases its quantity instead
     * @param {Resource} resource - The resource to be added
     */
     addResource(resource){
        // Calling getResource with returnEmpty == true will garauntee that
        // we have an Instance
        let existing = this.getResource(resource.resourcetype.id, true);

        // Update the item
        existing.quantity += resource.quantity;

        // Reassign it (in case getResource created the item itself)
        this.resources[resource.resourcetype.id] = existing;

        // Return the item
        return existing;
    }

    /**
     * Adds the given weapon to the Character's weapons array. If index is provided, it will be placed at that index.
     * @param {*} weapon - The weapon to be added
     * @param {*} [index] - The index to add the weapon at; if not provided the weapon will be pushed into the equipment
     * @returns 
     */
    addWeapon(weapon, index){
        // Insert weapon at index if provided
        if(typeof index !== 'undefined') this.weapons.insert(index, weapon);
        // Otherwise, push it
        else this.weapons.push(weapon);
    }

    /**
     * Removes a weapon by Index, Type, Type ID, or Instance. If index is not provided
     * then the first weapon matching the given weapon will be removed.
     * @param {Number} [index] - A specific index to remove
     * @param {Weapon | WeaponType | Number} [weapon] - A Weapon Instance, Weapon Type, or Weapon Type ID to match
     * @returns {Weapon | null} - The Weapon Instance removed (or null if such a Weapon cannot be removed)
     */
    removeWeapon(index, weapon){
        // Weapon was supplied, so try to find the index of that weapon
        if(typeof index == "undefined"){
            index = this.weapons.findEquipmentIndex(weapon);
        }
        
        // No such weapon to remove therefore no index
        // Or index provided was invalid due to absence of a weapon
        if(index === null || index < 0 || !this.weapons[index] || typeof this.weapons[index] == "undefined" ) return;

        // Weapon/Index mismatch
        // NOTES- Should only happen if weapon and index were both provided by the caller
        //      - As usual, should be an error
        if(weapon && this.weapons[index].type.id != weapon) return;

        // Save a reference to the weapon we're removing for the return
        weapon = this.weapons[index];
        this.weapons.remove(index);

        // Return removed Weapon Instance
        return weapon;
    }

    /**
     * Removes an Item by Index, Type, Type ID, or Instance. If index is not provided
     * then the first weapon matching the given weapon will be removed.
     * @param {Number} [index] - A specific index to remove
     * @param {Item | ItemType | Number} [item] - An Item Instance, Item Type, or Item Type ID to match
     * @param {Number} [qty] - An quantity to remove from the Item; if omitted, the entire Item will be removed
     * @returns {[Item | null, Number | null]} - Returns a length-2 array with the Item Instance removed (or null
     *      if such an Item cannot be removed) and the Index it was removed from (or null if it wasn't removed)
     */
    removeItem(index, item, qty){
        // Item was supplied, so try to find the index of that item
        if(typeof index == "undefined"){
            // Now we find the first index that successfully passes our finder method
            index = this.items.findEquipmentIndex(item);
        }
        // No such item to remove therefore no index
        // Or index provided was invalid due to absence of a weapon
        if(index === null || index < 0 || !this.items[index] || typeof this.items[index] == "undefined" ) return [null, null];

        // Item/Index mismatch
        // NOTES- Should only happen if item and index were both provided by the caller
        //      - As usual, should be an error
        if(item && this.items[index].type.id != item.type.id) return [null, null];

        // If qty is not provided, fully remove the item
        if(typeof qty == "undefined"){
            item = this.items[index];
            this.items.remove(index);
        }
        // Otherwise, simply removed the required qty
        else{
            // Make sure we don't remove more qty than we have
            let rmvqty = Math.min(qty, this.items[index].quantity);
            // Create a new Item Instance to return with the removed qty
            item = this.items[index].new(rmvqty);
            // Remove the qty from the inventoried Item
            this.items[index].quantity -= rmvqty;
            // If the item no longer has a quantity, automatically drop it
            if(!this.items[index].quantity) this.items.remove(index);
        }

        // Return the removed (qty of the) Item Instance
        return [item, index];
    }

    /**
     * Removes the given resource from the Player. If qty is given, then at most
     * that much quantity will be removed.
     * @param {Number} resource - The Resource ID to remove
     * @param {Number} [qty] - The amount to remove
     * @returns {Resource} - A resource Object with the amount of quantity removed from the Player
     */
    removeResource(resource, qty){
        // Get the Resource Instance from the Player
        let obj = this.getResource(resource);
        
        // If obj is null, then the Player doesn't have any to remove, so we can return now
        // but we have to create the instance ourself
        if(!obj) return this.game.createEquipmentInstance("Resource", resource, 0);

        // If qty wasn't supplied, we remove all of it
        if(typeof qty == "undefined"){
            // Remove the Resource from the Player completely
            delete this.resources[resource];

            // We can return the obj we got earlier
            return obj;
        }

        // Otherwise, we need to figure out whether obj actually has enough qty
        let removeqty = Math.min(obj.quantity, qty);

        // Remove that amount from the Player
        obj.quantity -= removeqty;

        // If the player no longer has any quantity, just remove the resource
        if(!obj.quantity) delete this.resources[resource];

        // Return an Object with the removed amount
        return this.game.createEquipmentInstance("Resource", resource, removeqty);
    }

    /**
     * Applies and caps an HP change between 0 and max hp and notifies listeners
     * @param {Number} value - HP Change
     */
    adjustHP(value){
        // Don't do anything if hp hasn't changed
        if(!value) return;
        // Need initial hp to put in the event
        let initialHP = this.statistics.currentHP;
        // get new hp
        let hp = this.statistics.currentHP + value;
        // make sure to bound hp between 0 and hp
        this.statistics.currentHP = Math.max(0,Math.min(hp, this.statistics.hp));
        // Notify listeners that HP has changed
        this.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this, currentHP: this.statistics.currentHP, initialHP, rawchange: value});
        // If this has a reference to another character, trigger the change for that character as well
        if(typeof this.character !== "undefined") this.character.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this.character, currentHP: this.statistics.currentHP, initialHP, rawchange: value});
        return [value, initialHP, this.statistics.currentHP];
    }

    /**
     * Sets the Character's currentHP to the given amount (max the Character's hp stat) and notify listeners.
     * If there is no change in HP, listeners will not be notified.
     * @param {Number} value - The HP to set to
     */
    setHP(value){
        // Track change
        let initialHP = this.statistics.currentHP;
        // Set to max of stat.hp
        this.statistics.currentHP = Math.min(value, this.statistics.hp);
        // if change did not occur, exit early
        if(initialHP == this.statistics.currentHP) return;
        // Otherwise, notify listeners
        this.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this, currentHP: this.statistics.currentHP, initialHP, setvalue: value});
        // If this has a reference to another character, trigger the change for that character as well
        if(typeof this.character!== "undefined") this.character.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this.character, currentHP: this.statistics.currentHP, initialHP, setvalue: value});
        return [value, initialHP, this.statistics.currentHP];
    }

    /**
     * Returns whether or not the Character's currentHP is less than or equal to 0
     */
     isKOd(){
        return this.statistics.currentHP <= 0;
    }
}

/**
 * The Player Character's entity which has additional functionality
 */
export class PlayerCharacter extends Character{
    /**
     * 
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Game} game - The Game Object the Character belongs to
     * @param {Object} statistics - An object containing statistics.
     * @param {Number} statistics.hp - An integer representing the Character's max hp
     * @param {Number} statistics.currentHP - An integer representing the Character's current hp
     * @param {Number} statistics.vision - An integer representing the number of squares
     *                                      the Character can see on the Map
     * @param {Object}   equipment - An object containing equipment for the character
     * @param {Weapon[]} equipment.weapons - An Array of Weapon Objects available for the character
     * @param {Armor}    equipment.armor - An Armor object
     * @param {Item[]}   equipment.items - An Array of Item Objects owned by the character
     * @param {Resource[]}   equipment.resources - An Array of Resource Objects owned by the character
     */
    constructor(id, roles, game, statistics, equipment){
        super(id, roles, game);

        // It's arguably more future-proof not to individually pull out statistics
        // and just to copy whole the object over
        // Including some default stats
        this.statistics = Object.assign({hp: 5, currentHP: 5, vision: 3}, statistics);

        let weapons = new Equipment(CHARAWEAPONLOADOUT);
        // If there are weapons in equipment, copy the array over
        if(equipment.hasOwnProperty("weapons") && equipment.weapons){
            let weapon;
            for(let i = 0; i < equipment.weapons.length; i++){
                weapon = equipment.weapons[i];
                if(weapon && typeof weapon !== 'undefined') weapons.insert(i, weapon);
            }
        }

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor") && equipment.armor) armor = equipment.armor;

        let items = new Equipment(CHARAITEMLOADOUT);
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("items") && equipment.items){
            let item;
            for(let i = 0; i < equipment.items.length; i++){
                item = equipment.items[i];
                if(item && typeof item !== 'undefined') items.insert(i, item);
            }
        }

        let transport = null;
        // If there is transport, set the Character's transport to that transport
        if(equipment.hasOwnProperty("transport") && equipment.transport) transport = equipment.transport;

        let resources = {};
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("resources") && equipment.resources) Object.assign(resources, equipment.resources);

        this.equipment = {weapons, armor, items, transport, resources};
    }

    /**
     * Returns a new CombatCharacter based on the Player Character
     */
    getCombatCharacter(){
        return new CombatCharacter(this.id, this.roles, this.statistics, this.equipment, this);
    }
    

    /**
     * Returns the PlayerCharacter's carried weight
     */
    get weight(){
        let weight = 0;
        // Note- Buckets may have empty indices, so need to check first
        for(let weapon of this.equipment.weapons) weight+= weapon ? weapon.weapontype.weight : 0;
        for(let item of this.equipment.items) weight += item ? item.totalWeight: 0;
        for(let resource of Object.values(this.equipment.resources)) weight += resource ? resource.totalWeight: resource;
        return weight;
    }

    get weapons(){return this.equipment.weapons;}
    get items(){ return this.equipment.items;}
    get resources(){ return this.equipment.resources;}
    get transport(){ return this.equipment.transport;}
    get armor(){ return this.equipment.armor;}
}

/**
 * A sublcass of Entity which comes with combat statistics and functions
 */
export class CombatCharacter extends Character{
    /**
     * 
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Object} statistics - An object containing combat statistics.
     * @param {Number} statistics.hp - An integer representing the Character's max hp
     * @param {Number} statistics.currentHP - An integer representing the Character's current hp
     * @param {Object}   equipment - An object containing equipment for the character
     * @param {Weapon[]} equipment.weapons - An Array of Weapon Objects available for the character
     * @param {Armor}    equipment.armor - An Armor object
     * @param {Item[]}   equipment.items - An Array of Item Objects owned by the character
     * @param {Resource[]} equipment.resources - An Array of Resource Objects owned by the character
     */
    constructor(id, roles, statistics, equipment, character){
        super(id, roles);
        // If this character was built off of another character (e.g.- The Player Character)
        // save a backreference to it
        this.character = character;

        this.statistics = statistics;


        let weapons = [];
        // If there are weapons in equipment, use that value
        if(equipment.hasOwnProperty("weapons")) weapons = equipment.weapons;
        // If that happens to be an Equipment Object, we'll only take the loadout
        if(typeof weapons.getLoadout !== "undefined") weapons = weapons.getLoadout();

        // Note- We're hiding this variable as most objects interacting with
        //      CombatCharacters only want to be passed non-empty slots
        this._weapons = weapons;

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor")) armor = equipment.armor;
        this.armor = armor;

        let items = [];
        // If there are items in equipment, use that value
        if(equipment.hasOwnProperty("items")) items = equipment.items;
        // If that happens to be an Equipment Object, we'll only take the loadout
        if(typeof items.getLoadout !== "undefined") items = items.getLoadout();
        this._items = items;

        let resources = {};
        // If there are items in equipment, use that value
        if(equipment.hasOwnProperty("resources")) resources = equipment.resources;
        this.resources = resources;
    }

    /**
     * Return a list of non-empty weapon slots
     */
    get weapons(){
        let output = [];
        for(let weapon of this._weapons){
            if(!weapon || typeof weapon == "undefined") continue;
            output.push(weapon);
        }
        return output;
    }

    /**
     * Return a list of non-empty item slots
     */
    get items(){
        let output = [];
        for(let item of this._items){
            if(!item || typeof item == "undefined") continue;
            output.push(item);
        }
        return output;
    }

    /**
     * Returns a random weapon
     * @param {*} [random] - A random number generator
     * @returns {Weapon | null} - Returns a random weapon from this
     *                              Character's weapons, or null if it has none
     */
    randomWeapon(random){
        // No available weapons
        if(!this.weapons.length) return null;
        return UTILS.randomChoice(this.weapons, random);
    }

    /**
     * Calls updateTimers on the Character's weapon loadout
     * @param {Number} now- Performance.now
     */
    updateWeapons(now){
        // DEVNOTE- Because index (Slot) is important, we can't iterate over this.weapons normally
        //      and have to use the private this._weapons variable instead (which may include empty slots)
        for(let index = 0; index< this._weapons.length; index++){
            let weapon = this._weapons[index];
            if(!weapon || typeof weapon == "undefined") continue;
            let cooldown = weapon.cooldown.isReady;
            let warmup = weapon.warmup.isReady;
            weapon.updateTimers(now);
            if(weapon.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.weaponchange, {subtype: "timer", item: weapon, timer: "cooldown", index});
            if(weapon.warmup.isReady != warmup) this.triggerEvent(Character.EVENTTYPES.weaponchange, {subtype: "timer", item: weapon, timer: "warmup", index});
        }
    }

    /**
     * Calls updateTimer on the Character's item loadout
     * @param {Number} now - Performance.now
     */
    updateItems(now){
        for(let item of this.items){
            let cooldown = item.cooldown.isReady;
            item.updateTimer(now);
            if(item.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.itemschange, {subtype: "timer", item, timer: "cooldown"});
        }
    }

    /**
     * Returns the first weapon that isAvailable or null if no weapons are available
     * @returns {Weapon | null} - returns the first weapon that isAvailable or null
     */
    firstAvailableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isAvailable(this)) return weapon;
        }
    }

    /**
     * Returns the first weapon that isFireable or null if no weapons are Fireable
     * @returns {Weapon | null} - returns the first weapon that isFireable or null
     */
    firstFireableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isFireable(this)) return weapon;
        }
    }
}

