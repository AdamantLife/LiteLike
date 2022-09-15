"use strict";
import * as EQUIP from "./items.js";
import * as COLONY from "./homebase.js";
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

export function loadColony(){

    function parse(data){
        let jobs = {}, sectors = {};

        jobs = parseStandardJson(data.job, COLONY.Job);
        sectors = parseStandardJson(data.sector, COLONY.Sector);


        return {jobs, sectors};
    }

    return fetch("./entities/colony.json")   // Fetch items.json from the server
        .then(r=>r.json())                      // Then convert the file to an Object (json)
        .then(data=>parse(data))                // The pass the converted object to the parse function
    // Return the resulting promise so that the calling function can take
    // action after it is done
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
            id= obj.id;
            dict = language.sector;
            break;
        case "Job":
            id = obj.id;
            dict = language.job;
            break;
        default:
            return {"name":"Unknown", "flavor": "Unknown"}
    }
    return dict[id];
}