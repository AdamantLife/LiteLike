"use strict";

import * as UTILS from "./utils.js";
import { PlayerCharacter } from "./character.js";

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
const UNEXPLOREDPORT = "!"
// Station Symbol
// This is our version of a City from ADR
const STATIONSYMBOL = "$";
// Dungeon Symbol
// This is what we call Mines from ADR
const DUNGEONSYMBOL = "&";

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
        "movestart", "move", "moveend",
        "enterunexplored", "leaveunexplored",
        "enterport", "leaveport",
        "enterdungeon", "leavedungeon",
        "enterstation", "leavestation",
        "entercolony", "leavecolony",
        "mapchange"
    );

    /**
     * 
     * @param {String | null} seed - Random Seed for the map (if not provided, one will be created
     * @param {Number[][] | true} mask - An array of Strings representing the revealed map. If true,
     *      generate a new mask which is filled with 0's
     * @param {Character} player - The Player Character
     */
    constructor(seed, mask, player){
        super(Map.EVENTTYPES);
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
        this.map = null;
        this.player = player;
        this.playerLocation = null;
        // Set default location as HOMECOORD
        this.moveToHome();

        this.playerQueue = [];
        this.mapLock = true;
        this.loopid;
    }

    /**
     * Convenience function to change the Player's Location
     * to HOMECOORD; does not trigger any movement effects
     */
    moveToHome(){
        this.playerLocation = Array.from(HOMECOORD);
    }

    /**
     * Returns the manhattan distance between HOMECOOD and playerLocation
     * @returns {Number} - The manhattan distance from Home to the Player's Coord
     */
    distanceFromHome(){
        return Math.abs(this.playerLocation[0] - HOMECOORD[0])+ Math.abs(this.playerLocation[1] - HOMECOORD[1]);
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
        this.triggerEvent(Map.EVENTTYPES.moveend, {direction, playerLocation: this.playerLocation});

        if(!result) return;
        // Subtract the required fuel
        // NOTE - There didn't seem to be a cost-difference for terrain type in A Dark Room
        //          If there was, we would calclulate that here
        this.player.equipment.transport.reactorPower -= MOVEFUELCOST;
        this.player.triggerEvent(PlayerCharacter.EVENTTYPES.equipmentchange, {subtype:"fuel", transport:this.player.equipment.transport});
        // Subtract required repair cost
        // Repairbots are always the first (0-index) item
        this.player.equipment.items[0].quantity -= MOVEREPAIRCOST;
        
        // Actual inventory changed
        // We have to check like this because MOVEREPAIRCOST is fractional and we round up
        let inventorychange = Math.ceil(this.player.equipment.items[0].quantity) - Math.ceil(this.player.equipment.items[0].quantity+MOVEREPAIRCOST);
        if(inventorychange){
            // Notify that inventory has changed
            this.player.triggerEvent(PlayerCharacter.EVENTTYPES.itemschange, {0:inventorychange});
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
        if(0 <= destination[0] <= MAPSIZE-1 && 0 <= destination[1] <= MAPSIZE-1){
            // Check if the player is moving into or out of a port, colony, or dungeon
            let fromSymbol = this.getSymbolAtLocation(this.playerLocation), toSymbol = this.getSymbolAtLocation(destination);

            let eventtype;
            // Out of a special location
            switch(fromSymbol){
                case COLONYSYMBOL:
                    eventtype = Map.EVENTTYPES.leavecolony;
                    break;
                case UNEXPLOREDPORT:
                    eventtype = Map.EVENTTYPES.leaveunexplored;
                    break;
                case PORTSYMBOL:
                    eventtype = Map.EVENTTYPES.leaveport;
                    break;
                case STATIONSYMBOL:
                    eventtype = Map.EVENTTYPES.leavestation;
                    break;
                case DUNGEONSYMBOL:
                    eventtype = Map.EVENTTYPES.leavedungeon;
                    break;
            }
            if(eventtype) this.triggerEvent(eventtype, {direction, playerLocation: this.playerLocation, destination});

            eventtype = null;
            // Into a special location
            switch(toSymbol){
                case COLONYSYMBOL:
                    eventtype = Map.EVENTTYPES.entercolony;
                    break;
                case UNEXPLOREDPORT:
                    eventtype = Map.EVENTTYPES.enterunexplored;
                    break;
                case PORTSYMBOL:
                    eventtype = Map.EVENTTYPES.enterport;
                    break;
                case STATIONSYMBOL:
                    eventtype = Map.EVENTTYPES.enterstation;
                    break;
                case DUNGEONSYMBOL:
                    eventtype = Map.EVENTTYPES.enterdungeon;
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
        // We return without doing anything if we moved off the map (return null;)
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
        if([UNEXPLOREDPORT, DUNGEONSYMBOL, STATIONSYMBOL].indexOf(symbol) < 0) return;

        // Replace the UnexpoloredPort/Planet/Station with a Port Symbol
        // Note that replaceSymbolAtLocation modifies the object inplace, so our map object
        // is automatically "overwritten"
        this.replaceSymbolAtLocation(this.map, location, PORTSYMBOL);
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
            if(location[0] < 0 || location[0] > MAPSIZE ||
                location[1] < 0 || location[1] > MAPSIZE) return;

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