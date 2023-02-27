"use strict";

import * as UTILS from "./utils.js";
import { PlayerCharacter } from "./character.js";
import { MapGUI } from "./gui/map.js";

// Map is 21x21 grid
const MAPSIZE = 21;
// Coords are 0-index, so 10,10 is center of map
// Coordinates are (x, y)
const HOMECOORD = [10,10];
// Each square costs 1 reactorFuel
const MOVEFUELCOST = 1;
// Every 2 squares costs 1 Repair Bots (this is cost for 1 square)
// Repair Bots are rounded up
const MOVEREPAIRCOST = 1/2;

// How the Player is represented on the Text Map
// This is the traditional rogue symbol
const PLAYERSYMBOL = "@";
// Colony Symbol
const COLONYSYMBOL = "C";
// Port Symbols
// Port is a Structure that you cleared previously
// and revist to pickup some travelling supplies
const PORTSYMBOL = "#";
// Unexplored Port is our equivalent of a House
// In A Dark Room
const UNEXPLOREDPORTSYMBOL = "!"
// Station Symbol
// This is our version of a City from ADR
const STATIONSYMBOL = "$";
// Planet Symbol
// This is what we call Mines from ADR
const PLANETSYMBOL = "&";

// An empty Cell
export const EMPTY = ".";

export const directions = UTILS.enumerate("NORTH","EAST","SOUTH","WEST");

export const mapactions = UTILS.enumerate("MOVE");

export class MapAction{
    /**
     * Initializes a new MapAction which can be added to Map.playerQueue
     * @param {Symbol | String} action - a mapaction symbol or it's string
     * @param {*} value - an appropriate value for the given action
     */
    constructor(action, value){
        // this is a String: convert it to a Symbol
        if(typeof mapactions[action] !== "undefined") action = mapactions[action];
        this.action = action;
        this.value = value;
    }
}

/**
 * Object managing the map
 */
export class Map extends UTILS.EventListener{
    static EVENTTYPES = UTILS.enumerate(
        "loopstart", "loopend",
        "nofuel", "norepair",
        "movestart", "move", "moveend",
        "enterunexplored", "leaveunexplored",
        "enterport", "leaveport",
        "enterplanet", "leaveplanet",
        "enterstation", "leavestation",
        "entercolony", "leavecolony",
        "mapchange"
    );

    /**
     * 
     * @param {Game} game - The game this map belongs to
     * @param {String | null} seed - Random Seed for the map (if not provided, one will be created
     * @param {Number[][] | true} mask - An array of Strings representing the revealed map. If true,
     *      generate a new mask which is filled with 0's
     * @param {Number[]} clearList - An array of structure ids  which have already been cleared by the Player
     * @param {Character} player - The Player Character
     */
    constructor(game, seed, mask, clearList, player){
        super(Map.EVENTTYPES);
        this.game = game;
        this.seed = seed;
        // If mask is true, generate a new, empty (all 0's) mask
        if(mask === true){
            let row;
            mask = [];
            for(let y = 0; y < MAPSIZE; y++){
                row = [];
                for(let x = 0; x < MAPSIZE; x++) row.push(0);
                mask.push(row);
            }
        }
        this.mask = mask;
        if(!clearList || typeof clearList == "undefined") clearList = [];
        this.clearList = clearList;
        this.map = null;
        // this.structures is used to get Structure IDs
        this.structures = {};
        this.#createMap();
        this.player = player;
        this.playerLocation = null;
        // Set default location as HOMECOORD
        this.moveToHome();

        this.playerQueue = [];
        this.mapLock = true;
        this.loopid;

        this.ui = null;
    }

    /** Pseudorandom Algorithm for generating a map using this.seed */
    #createMap(){
        this.map = [];
        // Initialize predictable random to (re)generate map based on seed
        let random = new Math.seedrandom(this.seed);

        // Intialize a blank map (all . symbols)
        // Pretty straightforward list generation from https://stackoverflow.com/a/55579551
        this.map = Array.from({length: MAPSIZE}, (value, index)=> Array.from({length:MAPSIZE}, (value, index)=> EMPTY));

        /**
         * DEVNOTE- Description of current algorithm
         * 
         * Map is nominally divided into 49 3x3 Sectors;
         *      Sector 24 (0-indexed, the Center Sector) is prepopulated with The Colony
         * 
         * There are 3 types of explorable "Structures"
         * There are garuanteed to be 5 Planets
         * There are between 3-6 Stations
         * There are 8-12 Unexplored Ports
         * 
         * Sectors are randomly assigned to Structures
         * Each Structure is randomly placed in a cell within its assigned Sector
         * 
         * NOTES- on Distribution:
         *      * In the current Algorithm, the distribution is completely random
         *          therefore structures may be relatively clustered
         *          * This may or may not be desireable:
         *              * On the one hand, it would be somewhat natural, as objects
         *                  and people tend to cluster together
         *              * On the other, this would not convey the isolation of Deep
         *                  Space which the Game may want to convey
         *      * Not only can Structures in-general be Clustered, but types of
         *          structures may also be Clustered: i.e.- Planets
         *          * Because Planets Unlock Upgrades, this may not be good for the game
         *      * Furthermore, Difficulty is determined by distance from The Colony:
         *          this means that Difficulty may not be evenly distributed
         *      * The Counter Argument to all the above: this game is being designed as a
         *          Roguelite, which means that the Focus on Randomness can produce more
         *          Replayability
         *          * The only question is how much that Replayability needs to be balanced
         *              with the Gameplay Experience as generated by complete Randomness.
         */
        let planets = 5;
        // Random() * 4 produces a value between 0 and 3.999...
        // which rounds down and adds to give a number between 3 and 6
        let stations = Math.floor(random()*4)+3;
        let unexplored = Math.floor(random()*5)+8;


        // Creating a collection of Remaining Symbols that we can destructively pull from
        // NOTE- this method was chosen as it's cleaner than having a loop for each Structure Type
        let remaining_structures = [
            ... Array.from({length: planets}, ()=>PLANETSYMBOL),
            ...Array.from({length: stations}, ()=>STATIONSYMBOL),
            ...Array.from({length: unexplored}, ()=>UNEXPLOREDPORTSYMBOL)
        ];

        // DEVNOTE- We're hardcoding the sector count for now. This will screw us up
        //      if MAPSIZE changes, but we're also hardcoding HOME so it's a bit of a
        //      moot problem
        // Generate a list of Sectors to destructively pull from
        let sectors = Array.from({length: 49}, (value,index)=> index);

        // NOTE- See note above about hardcoding
        let HOMESECTOR = 24;

        // Track the structure ID in order to index it against the clearList
        let structureId = 0;

        // Iterate over all the structures
        while(remaining_structures.length){
            // Get our sector first
            // NOTE- we have to do this first because we didn't preemptively pull
            //      the Home Sector out
            let sector = UTILS.randomChoice(sectors, random);
            // Remove Sector from list
            sectors.splice(sectors.indexOf(sector), 1);
            // HOMESECTOR is special
            if(sector == HOMESECTOR){
                // NOTE- technically we could just skip this sector
                //      and add The Colony later, but we're here now anyway
                this.map[HOMECOORD[0]][HOMECOORD[1]] = COLONYSYMBOL;
                // Go to the next iteration
                continue;
            }
            // Pull the first structure out
            // NOTE- Because we're randomly selecting a Sector to go with it, it doesn't
            //      matter that we're pulling Structures in order (i.e.- Planet, Planet, etc..)
            let structure = remaining_structures.shift();

            // Get X and Y major offsets of the Sector (Top-left Cell Coordinate)
            // NOTE- Refer to previous notes about Hardcoding
            // X-offset is Sector Number modulo Sectors-per-Row * x-cells-per-Sector
            let X = sector % 7 * 3;
            // X-offset is Sector Number divided by Sectors-per-Row (rounded-down) * y-cells-per-Sector
            let Y = Math.floor(sector / 7) * 3;

            // Get Random offset from X and Y
            let x = X + Math.floor(random()*3);
            let y = Y + Math.floor(random()*3);

            // Log the Structure's Location
            // NOTE- we're doing this so we can save the structure type
            //      before we check if it's been cleared
            this.structures[[x,y]] = {id: structureId, structure};

            // Check if structure is  on the clearList
            if(this.clearList.indexOf(structureId) >= 0){
                // Replace the structure the structure with a PORTSYMBOL
                structure = PORTSYMBOL;
            }

            // Place structure
            this.map[y][x] = structure;
            
            // Increment the structureID
            structureId+=1;
        }

        // Now that we're done generating the map, we'll join the rows up into strings
        for(let i = 0; i < this.map.length; i++){
            this.map[i] = this.map[i].join("");
        }
    }

    setupUI(){
        this.ui = new MapGUI(this);
        this.ui.setupUI();
    }

    /**
     * Convenience function to change the Player's Location
     * to HOMECOORD; does not trigger any movement effects
     */
    moveToHome(){
        this.playerLocation = Array.from(HOMECOORD);
    }

    /**
     * Returns the manhattan distance between HOMECOOD and the given location
     * @param {Number[]} [location]- the Location to use; defaults to this.playerLocation
     * @returns {Number} - The manhattan distance from Home to the Player's Coord
     */
    distanceFromHome(location){
        if(!location || typeof location == "undefined") location = this.playerLocation
        return Math.abs(location[0] - HOMECOORD[0])+ Math.abs(location[1] - HOMECOORD[1]);
    }

    /**
     * Determines the Encounter Tier of the location based on its distance from The Colony
     * @param {*} location 
     */
    getLocationTier(location){
        // Use the distance from The Colony to determine the Tier
        // NOTE- Tiers are 1-indexed, so we need to use Math.ceil
        // DEVNOTE- Using this method evenly spaces the tiers: we may want to to revist this if
        //      it seems like the Player needs to have a wider "easy" range
        return Math.ceil(this.distanceFromHome(location) / this.game.ENCOUNTERS.tiers.length);
    }

    /**
     * Very simply cancels the timeout for moveLoop
     */
    clearLoop(){
        window.clearTimeout(this.loopid);
    }

    moveLoop(){
        this.triggerEvent(Map.EVENTTYPES.loopstart, {});
        let playerQueue = Array.from(this.playerQueue);
        this.playerQueue = [];
        if(this.mapLock) return this.loopid = window.setTimeout(this.moveLoop.bind(this), UTILS.LOOPRATE);
        let moves = [];

        // Sort the actions into moves and inventory
        for(let action of playerQueue){
            if(action.action === mapactions.MOVE) moves.push(action.value);
        }

        // Right now we're only resolving the first move action in the queue
        if(moves.length) this.handleMove(moves[0]);
        
        this.triggerEvent(Map.EVENTTYPES.loopend, {});
        this.loopid = window.setTimeout(this.moveLoop.bind(this), UTILS.LOOPRATE);
    }

    /**
     * Takes a direction and attempts to move the character in that direction
     * We could execute them all, but that could introduce exploits.
     * @param {Symbol | String} direction - A  enumerated direction string or Symbol
     */
    handleMove(direction){
        if(typeof direction !== "symbol") direction = directions[direction];
        // invalid direction
        if(typeof direction === "undefined") return;

        let result;
        [direction, result] = this.move(direction);
        if(!result) return;

        // Check if the Player actually has the reactor power to move
        // If he doesn't, trigger a nofuel event
        if(!this.player.equipment.transport.reactorPower){
            // Listeners can prevent us from exiting prematurely by returning false.
            let result = this.triggerEvent(Map.EVENTTYPES.nofuel, {direction, player: this.player, playerLocation: this.playerLocation})
            if(result !== false) return;
        };

        this.triggerEvent(Map.EVENTTYPES.moveend, {direction, playerLocation: this.playerLocation});
        
        // Subtract the required fuel
        // NOTE - There didn't seem to be a cost-difference for terrain type in A Dark Room
        //          If there was, we would calclulate that here
        this.player.equipment.transport.reactorPower -= MOVEFUELCOST;
        this.player.triggerEvent(PlayerCharacter.EVENTTYPES.equipmentchange, {subtype:"fuel", transport:this.player.equipment.transport});
        // Get the player's repairbots and subtract required repair cost
        // NOTE- Repairbots are ID 0 and returnEmpty (second argument) ensures that the Instance is always returned
        let repairbot = this.player.getItem(0, true);

        // If the player doesn't have any Repair Bots, trigger the norepair event and
        // exit (we don't have anythign else to do)
        if(!repairbot.quantity) return this.triggerEvent(Map.EVENTTYPES.norepair, {player: this.player, item: repairbot});

        // Otherwise, subtract the MOVEREPAIRCOST
        repairbot.quantity -= MOVEREPAIRCOST;
        
        // MOVEREPAIRCOST is .5, so if Repairbot's quantity is a whole number
        // then we trigger the itemschange event
        // NOTE- This is because we assume the GUI rounds up; if it rounded down
        //  we would want to trigger itemschange when it was not a whole number
        if(! (repairbot.quantity - Math.floor(repairbot.quantity) )){
            // Notify that inventory has changed
            // NOTE- the change will always be -1 unless MOVEREPAIRCOST is greater than 1
            this.player.triggerEvent(PlayerCharacter.EVENTTYPES.itemremoved, {item: repairbot, index : this.player.getItemIndex(repairbot.type.id)});
        }

        
    }

    /**
     * 
     * @param {String} direction 
     */
    move(direction){
        this.triggerEvent(Map.EVENTTYPES.movestart, {direction, playerLocation: this.playerLocation});
        if(typeof direction !== "symbol") direction = directions[direction];
        let destination = [... this.playerLocation];
        // Each direction changes the Player's positions by 1 square in the
        // x or y axis
        switch(direction){
            case directions.NORTH:
                destination[1]-=1;
                break;
            case directions.EAST:
                destination[0]+=1;
                break;
            case directions.SOUTH:
                destination[1]+=1;
                break;
            case directions.WEST:
                destination[0]-=1;
                break;
            default: // As always, we should raise an error, but are not for simplicity's sake
                return [null, null];
        }
        // Make sure we haven't moved off the map
        // We return without doing anything if we moved off the map (return false for result)
        if(0 > destination[0] || destination[0] >= MAPSIZE ||
            0 > destination[1] || destination[1] >= MAPSIZE) return [direction, false];

        // Check if the player is moving into or out of a port, colony, or planet
        let fromSymbol = this.getSymbolAtLocation(this.playerLocation), toSymbol = this.getSymbolAtLocation(destination);

        let eventtype;
        // Out of a special location
        switch(fromSymbol){
            case COLONYSYMBOL:
                eventtype = Map.EVENTTYPES.leavecolony;
                break;
            case UNEXPLOREDPORTSYMBOL:
                eventtype = Map.EVENTTYPES.leaveunexplored;
                break;
            case PORTSYMBOL:
                eventtype = Map.EVENTTYPES.leaveport;
                break;
            case STATIONSYMBOL:
                eventtype = Map.EVENTTYPES.leavestation;
                break;
            case PLANETSYMBOL:
                eventtype = Map.EVENTTYPES.leaveplanet;
                break;
        }
        if(eventtype) this.triggerEvent(eventtype, {direction, playerLocation: this.playerLocation, destination});

        eventtype = null;
        // Into a special location
        switch(toSymbol){
            case COLONYSYMBOL:
                eventtype = Map.EVENTTYPES.entercolony;
                break;
            case UNEXPLOREDPORTSYMBOL:
                eventtype = Map.EVENTTYPES.enterunexplored;
                break;
            case PORTSYMBOL:
                eventtype = Map.EVENTTYPES.enterport;
                break;
            case STATIONSYMBOL:
                eventtype = Map.EVENTTYPES.enterstation;
                break;
            case PLANETSYMBOL:
                eventtype = Map.EVENTTYPES.enterplanet;
                break;
        }
        
        if(eventtype) this.triggerEvent(eventtype, {direction, playerLocation: this.playerLocation, destination});

        // Update player's location
        this.playerLocation = destination;

        // Update Fog-of-War
        if(this.mask && typeof this.mask !== "undefined") this.setVision(this.mask, this.playerLocation, this.player.statistics.vision);

        // Notify that player has moved
        let result = this.triggerEvent(Map.EVENTTYPES.move, {direction, playerLocation: this.playerLocation});
            
        return [direction, true];
    
        
    }


    /**
     * Returns the map as an array of strings.
     * 
     * If mask is provided, it should map 1-for-1 onto the Map and will be used Booleaned with each coordinate on the
     * map. If the mask is 1, then the character at the given coordinate will be displayed; otherwise, that coordinate
     * will be converted to a space.
     * @param {Object} options - Options for formatting the mask
     * @param {Number[] | null} options.mask - A series of Zeroes and non-Zeroes which will be mapped onto the map string
     * @param {Array[Location, String]} options.replacements - Symbol replacements to make on the map. The first element is the
     *          Location is where to do the replacements, the second is what to use as the replacement
     * @returns {String[]} - The map
     */
    getMap(options){
        if(!options || typeof options == "undefined") options = {};

        // Copy the map
        let map = Array.from(this.map);

        // Do replacements, if any
        if(options.replacements && typeof options.replacements !== "undefined"){
            for(let [location,replacement] of options.replacements) this.replaceSymbolAtLocation(map, location, replacement);
        }
        
        // Replace the symbol at this.playerLocation with the PLAYERSYMBOL
        this.replaceSymbolAtLocation(map, this.playerLocation, PLAYERSYMBOL)

        // Our default mask (may be null/undefined)
        let mask = this.mask;
        // If options provides a mask, use that instead
        if(options.mask || typeof options.mask !== "undefined") mask = options.mask;
        // No mask, just return the map as-is
        if(!mask || typeof mask === "undefined") return map;

        // Iterator for both map and mask
        for(let i = 0; i < map.length; i++){
            // Split the current map row into individual characters
            let mapstringarray = map[i].split("");
            let maskarray = mask[i];
            let rowmaskvalue = maskarray.reduce((a,b)=>a+b);
            // If maskarray is empty (All zeroes), do not show any characters on this row
            if(!rowmaskvalue){
                // Empty row
                map[i]=" ".repeat(MAPSIZE);
                continue;
            // If maskarray is all 1's
            }else if(rowmaskvalue == MAPSIZE){
                // Everything is displayed as-is
                continue;
            }
            // In this case some characters in the array are displayed and some are not
            let out = "";
            // Iterator for both mapstringarray and the current mask row(mask[i])
            // If mask[i][x] is not 0, then add the character at mapstringarray[x]
            // to the output; otherwise add a space
            for(let x = 0; x < mapstringarray.length; x++) out += maskarray[x]? mapstringarray[x] : " ";

            // Replace the map row with the masked output
            map[i] = out;
        }

        // Return the masked map
        return map
    }

    /**
     * Returns the terrain symbol at the given location
     * 
     * @param {Number[]} location - A length-2 array of integers that fall within the map
     * @returns {undefined | String} - Returns the terrain symbol for the given location, or undefined for invalid location
     */
    getSymbolAtLocation(location){
        if(0 > location[0] > MAPSIZE || 0 > location[1] > MAPSIZE) return undefined;
        // Copy the map
        let map = Array.from(this.map);
        
        // Get the row for the location y coord
        let row = map[location[1]];

        // Return only the character at the given location x coord
        return row.slice(location[0],location[0]+1);
    }

    /**
     * Modifies the provided map array so that the provided replacement symbol is at the given map location
     * @param {*} map - A map array
     * @param {*} location - A length-2 array of integers that fall within the map
     * @param {*} replacement - A character to place at the target location
     * @returns {null} - This function modifies the object in place
     */
    replaceSymbolAtLocation(map, location, replacement){
        // Get the row the location is on
        let row = map[location[1]];
        map[location[1]] =                   // Replace the row with
            row.substring(0,location[0])     // The row up to the location y coordinate
            + replacement                    // the replacement symbol
            + row.substring(location[0]+1);  // The rest of the the row
    }

    /**
     * Replaces an Unexplored Port, Station, or Planet at the given locaion with a Port
     * @param {Number[]} [location = this.playerLocation] - A length-2 array of integers that fall within the map
     */
    clearStructureAtLocation(location){
        if(!location || typeof location == "undefined") location = this.playerLocation;
        // Get symbol at location
        let symbol = this.getSymbolAtLocation(location);
        // Make sure it's a valid symbol
        // If not, return (because we're not raising errors in this program)
        if([UNEXPLOREDPORTSYMBOL, PLANETSYMBOL, STATIONSYMBOL].indexOf(symbol) < 0) return;

        // Replace the UnexpoloredPort/Planet/Station with a Port Symbol
        // Note that replaceSymbolAtLocation modifies the object inplace, so our map object
        // is automatically "overwritten"
        this.replaceSymbolAtLocation(this.map, location, PORTSYMBOL);
        
        // Add the structure to our clearList by getting its
        // id from this.structures
        this.clearList.push(this.structures[location].id);

        // Trigger event to let listeners know that there has been a change to our Map
        this.triggerEvent(Map.EVENTTYPES.mapchange, {map: this.map, location});
    }

    /**
     * Modifies the provided mask to convert all 0's to 1's. The conversion
     * is centered on the given location and range is a number of  cells to
     * convert in a uniform radius
     * @param {Mask} mask - The mask to modify
     * @param {Coordinate} location - The epicenter of the conversion
     * @param {*} range - The distance from the epicenter that will be revealed
     * @returns {null} - The mask is modified in place
     */
    setVision(mask, location, range){
        /**
         * A recursive function to determine all the coordinates that fall within
         * a radius distance from the location 
         * @param {Object} cache - Our collection of coordinates
         * @param {Coordinate} location - The location to recurse from
         * @param {Number} range - How much range we have left to recurse
         */
        function recurseRadius(cache, location, range){
            // DEVNOTE- Doing these first two lines here makes the code cleaner;
            //          alternatively we could check and add before calling recurseRadius
            //          for each direction

            // Check to make sure that location is valid
            // If invalid, return without doing anything
            if(location[0] < 0 || location[0] > MAPSIZE-1 ||
                location[1] < 0 || location[1] > MAPSIZE-1) return;

            // Record the location
            // We're setting the value to the location so we don't need to reparse it
            cache[location] = location;

            // Base Case/Exit condition
            if(range == 0) return;

            // Reduce the range since we've traveled a square
            range = range - 1;

            // For each direction we can go from this location, recurse on that coordinate
            // Up
            recurseRadius(cache, [location[0], location[1]-1], range);
            // Right
            recurseRadius(cache, [location[0]+1, location[1]], range);
            // Down
            recurseRadius(cache, [location[0], location[1]+1], range);
            // Left
            recurseRadius(cache, [location[0]-1, location[1]], range);
        }

        // We're using an object as it will allow us to only collect unique values
        // Set does not work with arrays as it uses "===" (identity) to check if
        // the array is Unique within the Set.
        let cache = {};

        // Run recursion to get all visible squares
        recurseRadius(cache, location, range);

        // Set each coordinate to 1 on the mask
        for(let [x,y] of Object.values(cache)){
            // Set the mask value at the given coordinate to 1
            mask[y][x] = 1;
        }
    }

}