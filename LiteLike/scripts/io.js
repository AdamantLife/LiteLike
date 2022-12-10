"use strict";
import * as EQUIP from "./items.js";
import * as COLONY from "./colony.js";
import * as CHARACTER from "./character.js"
import {instanceFromJSON} from "./utils.js";
import {itemCallbacks} from "./callbacks.js";

/**
 * Most objects can be created directly from the provided json dict.
 * This function uses instanceFromJSON to do so.
 * @param {Object} data - Json data
 * @param {Prototype} objecttype - The object to create based on the json data
 * @returns 
 */
function parseStandardJson(data, objecttype){
    let output = [];
    // Each data item's index is its id
    for(let id = 0; id < data.length; id++){
        // Get item by id
        let item = data[id];
        // Set the weapon's id
        item.id = id;
        // Convert the json object to the desired object
        output.push(instanceFromJSON(objecttype, item));
    }
    return output;
}

/**
 * Loads the items json file and parses it into item classes
 */
export function loadItems(){
    function parse(data){
        let weapons = [], armor = [], items = [], resources = [], transports = [];

        weapons = parseStandardJson(data.weapon, EQUIP.WeaponType);

        armor = parseStandardJson(data.armor, EQUIP.Armor);
        
        // Item callbacks need to be generated based on their arguments
        // Each Item's id is its index in the Item array
        for(let id = 0; id < data.item.length; id++){
            // Get item by id
            let item = data.item[id];
            // Set the item's id
            item.id = id;
            // get Callback name
            let cb = item.callback;
            // Get args in order to create the callback
            let args = item.arguments;
            // Remove arguments from item as the ItemType class
            // does not accept them
            delete item.arguments;
            // Convert the callback name  to the actual callback
            // as returned by the callback factory
            item.callback = itemCallbacks[cb](...args);

            // add item to list
            items.push(instanceFromJSON(EQUIP.ItemType, item));
        }

        resources = parseStandardJson(data.resource, EQUIP.ResourceType);

        transports = parseStandardJson(data.transport, EQUIP.Transport);

        return {weapons, armor, items, resources, transports};
    }

    return fetch("./entities/items.json")   // Fetch items.json from the server
        .then(r=>r.json())                      // Then convert the file to an Object (json)
        .then(data=>parse(data))                // The pass the converted object to the parse function
    // Return the resulting promise so that the calling function can take
    // action after it is done
}

/**
 * Loads strings for the given language
 * @param {String} language - The language to laod
 */
export function loadStrings(language){
    // Valid Languages
    const LANGUAGES = ["english"];
    // Make sure that language is a valid language
    if(LANGUAGES.indexOf(language) < 0 ) throw new Error(`Invalid Language: ${language}`);

    return fetch(`./strings/${language}.json`) // Fetch the language dict from the server
        .then(r=>r.json()); // Then convert the file to an Object (json)
    // Return the resulting promise so the calling function can do something afterwards
}

/**
 * Loads items from colony.json
 */
export function loadColony(){

    function parse(data){
        let jobs = {}, sectors = {};

        // Jobs are standard format
        jobs = parseStandardJson(data.job, COLONY.Job);
        // Sectors can be parsed as standard format, but we need to update their sectorType
        let _sectors = parseStandardJson(data.sector, COLONY.Sector);

        for(let sector of _sectors){
            // Converting sectorType to the Enumerated Symbol
            sector.sectorType = COLONY.sectors[sector.sectorType];
            // Converting Sector Array to Object with sectorType as key
            sectors[sector.sectorType] = sector;
        }

        return {jobs, sectors};
    }

    return fetch("./entities/colony.json")   // Fetch items.json from the server
        .then(r=>r.json())                      // Then convert the file to an Object (json)
        .then(data=>parse(data))                // The pass the converted object to the parse function
    // Return the resulting promise so that the calling function can take
    // action after it is done
}

/**
 * Loads events from encoutners.json
 */
export function loadEncounters(){
    function parse(data){
        let combatants = [];

        // We do not parse Combatants as they are not singletons
        combatants = data.combatants;
        
        return {combatants};
    }
    
    return fetch("./entities/encounters.json")  // Fetch encounters.json from the server
        .then(r=>r.json())                  // Conver the file to an Object (json)
        .then(data=>parse(data))            // Pass the converted obejct to the parse function
    
    // Return the resulting promis so that the calling function can take action after it is done
}

/**
 * Creates a new CombatCharacter for the given combatant
 * @param {Number} id - The combatant id 
 * @param {*} combatants - GAME.ENCOUNTERS.combatants
 * @param {*} items - GAME.ITEMS
 */
export function createCombatant(id, combatants, items){
    // Get raw combatant data
    let comb = combatants[id];
    // Compile weapons
    let weapons = [];
    // Get WeaponType for each weaponid and convert to Weapon Object
    for(let weaponid of comb.weapons) weapons.push(new EQUIP.Weapon(items.weapons[weaponid]));

    // Compile items
    let combitems = [];
    // Get ItemType for each itemid and convert to Item Object with the given quantity
    // Add the Item to the items bag (items are unsorted)
    for(let [itemid, qty] of comb.items) combitems.push(new EQUIP.Item(items.items[itemid], qty));

    // Compile resources
    let combresources = [];
    // Get ResourceType for each resourceid and convert to Resource Object with the given quantity
    // Store that Resource Object at its correct index
    for(let [resid, qty] of comb.resources) combresources[resid]=new EQUIP.Resource(items.resources[resid], qty);

    return new CHARACTER.CombatCharacter(
        // ID, Roles
        // Combatants are all Enemys
        comb.name, [CHARACTER.roles.CHARACTER, CHARACTER.roles.ENEMY],
        // Statistics
        // All combatants start at full hp
        {hp: comb.hp, currentHP: comb.hp},
        // Equipment
        {
            weapons,
            armor: items.armor[comb.armor],
            items: combitems,
            resources: combresources
        });
}

/**
 * Searches the Language Object for the given Entity and returns its entry
 * @param {Object} language - A Language Object as returned by loadStrings
 * @param {Object} object - An entity
 */
export function getStrings(language, object){
    let id, dict;
    switch(object.constructor.name){
        case "Entity":
        case "PlayerCharacter":
        case "CombatCharacter":
            id=object.id;
            dict = language.character;
            break;

        // ITEMS
        case "Weapon":
        case "WeaponType":
            id = typeof object.weapontype === "undefined" ? object.id : object.weapontype.id;
            dict = language.weapon;
            break;
        case "Armor":
            id = object.id;
            dict = language.armor;
            break;
        case "Item":
        case "ItemType":
            id = typeof object.itemtype === "undefined" ? object.id : object.itemtype.id;
            dict = language.item;
            break;
        case "Resource":
        case "ResourceType":
            id = typeof object.resourcetype === "undefined" ? object.id : object.resourcetype.id;
            dict = language.resource;
            break;
        case "Transport":
            id = object.id;
            dict = language.transport;
            break;

        // BASE SPECIFIC
        case "Sector":
            id= Object.values(COLONY.sectors).indexOf(object.sectorType);
            dict = language.sector;
            break;
        case "Job":
            id = object.id;
            dict = language.job;
            break;
        default:
            return {"name":"Unknown", "flavor": "Unknown"}
    }
    return dict[id];
}

/**
 * Returns a function that can be used to translate any valid, predetermined, enumerated key into a
 * a String for the current Game Langauage
 * 
 * @param {Game} game - The game object in order to determine current language
 * @param {Object} strings - Enumeration for the current UI element defining all valid translation lookups
 * @param {String} key - The key in Language.ui that corresponds to the current UI
 * @returns {Function} - the translation function
 */
export function makeTranslationLookup(game, strings, key){
    /**
     * Translates the given symbol into the Game's current language
     * @param {Symbol} _enum - The enumerated 
     * @param {Object|null} [isTemplate=null] - If provided, isTemplate should be an object which will be used to replace ${key} 
     * @returns {String}- The translated string
     */
    function translate(_enum, isTemplate = false){
        // Translated strings are located in game.LANGUAGE
        // key is the translation lookup for the current UI
        // Each index of strings (the enumerated object provided on creation)
        //  should correspond to the same index in the translation lookup
        let string = game.STRINGS.ui[key][strings.index(_enum)];

        // If this is not a template that needs replacement, just return the string
        if(!isTemplate) return string;

        // Otherwise, we define a function that will pull the correct substitues
        // out of the isTemplate object in order to format the string
        // The function signature for replacement functions is:
        // (match, ...groupmatches, offset, string, groups)
        // so if we had more groups in our regex, we would need to adjust it to account
        // for them.
        // DEVNOTE- originally I had this written as ()=>isTemplate[arguments[arguments.length-1].name];
        //  but I decided it was easier to read like this; the first way is useful if we don't know how
        //  many groups there are going to be and just want access to the groups parameter (which is always
        //  the last index)
        let lookup = (match, group1, group2, offset, string, groups)=>isTemplate[groups.name];
        // Replace all matches for our regex with the result of lookup(...matchargs)
        // The regex matches "${[non-whitespace-characters]}" and pulls the
        // non-whitespace-characters out as the "name" group
        return string.replace(/(\${(?<name>\w+)})/g, lookup);
    }
    return translate;
}