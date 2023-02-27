"use strict";
import * as GAME from "./game.js";
import * as MAP from "./map.js";
import * as ITEMS from "./items.js";
import * as COLONY from "./colony.js";
import * as CHARACTER from "./character.js";
import * as UTILS from "./utils.js";
import { MessageLog } from "./messagelog.js";
import {instanceFromJSON} from "./utils.js";
import {itemCallbacks} from "./callbacks.js";
import { GameplaySequence } from "./gameplay.js";


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

        weapons = parseStandardJson(data.weapon, ITEMS.WeaponType);

        armor = parseStandardJson(data.armor, ITEMS.Armor);
        
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
            items.push(instanceFromJSON(ITEMS.ItemType, item));
        }

        resources = parseStandardJson(data.resource, ITEMS.ResourceType);

        transports = parseStandardJson(data.transport, ITEMS.Transport);

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

        let tiers = [];
        // We also do not parse tiers, as they are only ID's
        tiers = data.tiers;
        
        return {combatants, tiers};
    }
    
    return fetch("./entities/encounters.json")  // Fetch encounters.json from the server
        .then(r=>r.json())                  // Conver the file to an Object (json)
        .then(data=>parse(data))            // Pass the converted obejct to the parse function
    
    // Return the resulting promis so that the calling function can take action after it is done
}

/**
 * Save the current gamestate to a file and immediately downloads that file
 * @param {Game} game - The game to save
 */
export function saveFile(game){
    let now = UTILS.now();

    // The object that will store all our data
    let output= {};

    // Saving Game RNG
    // DEVNOTE- this helps prevent save scumming/exploits (ymmv if that is good)
    output.state = game.random.state();

    // Record GameplaySequence info
    output.gameplay = {};
    output.gameplay.flags = game.GAMEPLAYSEQUENCE.flags.map(flag=>flag.description);

    // Record Map
    output.map = {};
    output.map.seed = game.MAP.seed;
    output.map.mask = game.MAP.mask;
    // DEVNOTE- we do not save Map.playerLocation because the game can only be saved in The Colony
    //      and always initializes from The Colony

    // Record Colony info
    output.colony = {};
    output.colony.powerLevel = game.COLONY.powerLevel;
    output.colony.unlocks = game.COLONY.unlocks.map(unlock=>unlock.description);
    output.colony.sectors = [];
    for(let sector of game.COLONY.sectors){
        // Saving sectorType, level, timer offsetTime and isReady so the timer can be reloaded in the same state
        // DEVNOTE- We are not currently saving sector cycles, but could in the future if we care about longterm stats
        output.colony.sectors.push([sector.sectorType.description, sector.level, sector.timer.getOffsetTime(now), sector.timer.isReady]);
    }
    output.colony.storage = {resources:[], items:[], weapons:[]};
    // All of this gets saved the same way
    for(let [outstorage,colonystorage] of [
        [output.colony.storage.resources, game.COLONY.resources],
        [output.colony.storage.items, game.COLONY.items],
        [output.colony.storage.weapons, game.COLONY.weapons],
    ]){
        for(let i = 0; i < colonystorage.length; i++){
            // If the colony has the item, then its id and quantity saved as a length-2 array
            if(colonystorage[i] !== null && typeof colonystorage[i] !== "undefined") outstorage.push([i,colonystorage[i]]);
        }
    }
    output.colony.meeples = [];
    // Saving meeple job, jobTimer.getOffsetTime, and hungerTimer.getOffsetTime in order to restore state
    // DEVNOTE- As with sectors, we currently do not care about longterm statistics
    // and therefore are only saving the essentials
    for(let meeple of game.COLONY.meeples){
        output.colony.meeples.push([meeple.job.id, meeple.jobTimer.getOffsetTime(now), meeple.hungerTimer.getOffsetTime(now)]);
    }

    // Record Player info
    output.player = {};
    // DEVNOTE- We currently are not saving id or roles because at the moment those never change
    output.player.statistics = game.PLAYER.statistics;
    output.player.equipment = {resources:[], items:[], weapons:[],
        // For armor and transport, we are only saving ID as they are singleton
        // Per DEVNOTES, the Player will always load the save into The Colony, so we don't
        //      need the transport's current fuel
        armor:game.PLAYER.armor !== null ?  game.PLAYER.armor.id : game.PLAYER.armor,
        transport: game.PLAYER.transport !== null ? game.PLAYER.transport.id : game.PLAYER.transport
    }

    // For weapons, we're saving the weapontype id and index
    for(let i = 0; i< game.PLAYER.weapons.length; i++){
        // Get the weapon at the given index
        let weapon = game.PLAYER.weapons[i];
        // skip if no weapon
        if(!weapon || typeof weapon == "undefined") continue;
        // Save index and weapon to output
        output.player.equipment.weapons.push([i,weapon.type.id]);
    }

    // Convert Item Array to index, id, qty arrays
    for(let i = 0; i < game.PLAYER.items.length; i++){
        // Get the item at the given index
        let item = game.PLAYER.items[i];
        // Skip if no item
        if(!item || typeof item == "undefined") continue;
        output.player.equipment.items.push([i, item.type.id, item.quantity]);
    }

    // Convert Resource Object to id, qty array
    for(let obj of Object.values(game.PLAYER.resources)){
        output.player.equipment.resources.push([obj.type.id, obj.quantity]);
    }
    

    // DEVNOTE- we do not save Game.ENCOUNTER because the game can only be saved in The Colony
    //      and always initializes from The Colony
        

    // Create hyperlink element
    // The link's href value is our json file stringified and encoded as a data uri
    // the file name is the download attribute
    document.body.insertAdjacentHTML("beforeend", `
<a
    href="data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(output))}"
    download="litelikesave.json"
    style="display:none;"
    ></a>`);
    // Clicking on the link begins the download
    document.body.lastElementChild.click();
    // Then just remove the element when we're done
    document.body.lastElementChild.remove();
}

/**
 * Loads a game from the given save file
 * @param {File} file - The save file
 * @param {GameplaySequence} gampeplaysequence - A GameplaySequence class to assign to the new game
 */
export function loadSave(file, gameplaysequence){
    /**
     * After the file has been loaded and parsed to JSON, a new game is
     * created within a promise (because Game loads data asynchronously)
     * @param {Object} savedata - The parsed json data of the file
     * @param {Promise} - A promise for when all the data has been loaded and parsed
     */
    function load(savedata){
        /**
         * The Promise function
         * When this is complete, it will return the newly-created game object
         */
        function loadData(resolve, error){
            let game;
            let now = UTILS.now();
        
            game = new GAME.Game(savedata.state, gameplaysequence);
            game.loadData().then((game)=>{
                let player, colony, map, gameplay, messagelog;

                let resources = {}, items = [], weapons = [];
                let equipment = {resources, items, weapons, armor: null, transport: null};

                // Armor and transport are singletons and therefore are just lookedup
                if(savedata.player.equipment.armor !== null) equipment.armor = game.ITEMS.armor[savedata.player.equipment.armor];
                // Otherwise, give him Basic Armor
                else{ equipment.armor = game.ITEMS.armor[0]; }
                if(savedata.player.equipment.transport !== null){
                    equipment.transport = game.ITEMS.transports[savedata.player.equipment.transport];
                    // Make sure Transport is topped off
                    equipment.transport.topOff();
                }

                // Resources, Items, and Weapons need instances generated
                for(let [id, qty] of savedata.player.equipment.resources){
                    let resource = new ITEMS.Resource(game.ITEMS.resources[id], qty);
                    resources[id] = resource;
                }
                for(let [index,id, qty] of savedata.player.equipment.items){
                    let item = new ITEMS.Item(game.ITEMS.items[id], qty);
                    items[index] = item;
                }
                for(let [index, id] of savedata.player.equipment.weapons){
                    let weapon = new ITEMS.Weapon(game.ITEMS.weapons[id]);
                    weapons[index] = weapon;
                }

                player = new CHARACTER.PlayerCharacter(0, [CHARACTER.roles.CHARACTER, CHARACTER.roles.PLAYER], game,
                    savedata.player.statistics,
                    equipment
                    );
        
                
                    let sectors = [];
                for(let [sectorType, level, offset, ready] of savedata.colony.sectors){
                    let sector = game.SECTORS[COLONY.sectors[sectorType]];
                    sector.level = level;
                    sector.newTimer(now);
                    sector.timer.setOffsetTime(now, offset);
                    if(ready){
                        sector.timer.setReady();
                        sector.timer.freeze();
                    }
                    sectors.push(sector);
                }

                let meeples = [];
                for(let [jobId, jobOffset, hungerOffset] of savedata.colony.meeples){
                    let meeple = new COLONY.Meeple(game.getJobById(jobId), now, now);
                    meeple.jobTimer.setOffsetTime(now, jobOffset);
                    meeple.hungerTimer.setOffsetTime(now, hungerOffset);
                    meeples.push(meeple);
                }

                colony = new COLONY.TheColony(game, savedata.colony.powerLevel,
                    sectors,
                    savedata.colony.unlocks,
                    savedata.colony.storage,
                    meeples
                );

                
                map = new MAP.Map(game, savedata.map.seed, savedata.map.mask, savedata.map.clearlist, player);

                game.PLAYER = player;
                game.COLONY = colony;
                game.MAP = map;
                game.MESSAGELOG = new MessageLog(game);

                // Gameplay has to be initialized after all other elements
                gameplay = new game._gameplayclass(game, savedata.gameplay.flags);
                game.GAMEPLAYSEQUENCE = gameplay;

                resolve(game);
            });
        }

        let loadComplete = new Promise(loadData);

        return loadComplete;
    }

    return new Promise((resolve, error)=>{
        // Load the file as text
        file.text()
            // Parse the file to json and pass to the load function 
            .then((text)=>load(JSON.parse(text)))
            .then(game=>resolve(game))
            .catch((e)=>{console.log("failed to load save file", e); error(e);})
    });    
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
    for(let weaponid of comb.weapons) weapons.push(new ITEMS.Weapon(items.weapons[weaponid]));

    // Compile items
    let combitems = [];
    // Get ItemType for each itemid and convert to Item Object with the given quantity
    // Add the Item to the items bag (items are unsorted)
    for(let [itemid, qty] of comb.items) combitems.push(new ITEMS.Item(items.items[itemid], qty));

    // Compile resources
    let combresources = [];
    // Get ResourceType for each resourceid and convert to Resource Object with the given quantity
    // Store that Resource Object at its correct index
    for(let [resid, qty] of comb.resources) combresources[resid]=new ITEMS.Resource(items.resources[resid], qty);

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
        let string = game.STRINGS.ui[key][strings.indexOf(_enum)];

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