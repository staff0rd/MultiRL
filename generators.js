/*
 * generators.js - Level generators for Ganymede Gate
 *
 * Code style:
 * 4 space indents, no semicolons to finish lines, camelCase, opening braces on same line
 *
 * Created by John Villar for the "Ganymede Gate" sci-fi multiplayer roguelike
 * http://ganymedegate.com
 * Twitter: @johnvillarz
 * Reddit: /u/chiguireitor
 * Google Plus: +JohnVillar
 *
 * Like this! Follow me on social networks & send some Bitcoin my way if you want ;)
 *
 * BTC: 1kPp2CNp1xs7hf8umUwdp4HYiZ9AH1NVk
 *
 * // Beginning of license //
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 John Villar
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * // End of license //
 *
 */
 
var fs = require('fs')
var rs = require('./rex_sprite.js')
var lightmanager = require('./lightmanager.js')

var prebuiltRooms = {
    "comfy": {
        "autoDoorsOnBorder": true,
        "probability": 1.0
    }
}
 
fs.readdir('./static/rooms/', function (err, files) {
        if (!err) {
            for (var i=0; i < files.length; i++) {
                (function (fn) {
                    var name = fn
                    var spl = fn.split('.')
                    
                    fs.readFile('./static/rooms/' + fn, function (errrf, data) {
                        if (!errrf) {
                            var nm = fn.split('.')[0]
                            var obj
                            
                            if (nm in prebuiltRooms) {
                                obj = prebuiltRooms[nm]
                            } else {
                                obj = {}
                                prebuiltRooms[nm] = obj
                            }
                            
                            obj.sprite = new rs.RexSprite(data)
                        } else {
                            console.log('Couldn\'t load sound: ' + name)
                        }
                    })
                })(files[i])
            }
        } else {
            console.log('Error reading Wav sound: ' + err)
        }
    })
 
function splitRandomSquare(generator, sq) {
    if (generator.random() < 0.5) {
        // Horizontal break
        return [{x: sq.x, y: sq.y, w: Math.ceil(sq.w/2) + 1, h: sq.h},
                {x: sq.x + Math.ceil(sq.w/2), y: sq.y, w: sq.w - Math.ceil(sq.w/2), h: sq.h}]
    } else {
        // Vertical break
        return [{x: sq.x, y: sq.y, w: sq.w, h: Math.ceil(sq.h/2) + 1},
                {x: sq.x, y: sq.y + Math.ceil(sq.h/2), w: sq.w, h: sq.h - Math.ceil(sq.h/2)}]
    }
}

function calcBspSquares(generator, level, minarea, randomaccept) {
    var sqs = [{x: 0, y: 0, w: level[0].length, h: level.length}]
    var mindim = Math.ceil(Math.sqrt(minarea))
    var ret = []

    while (sqs.length > 0) {
        var cur = sqs.pop()
        
        if ((cur.w > mindim)&&(cur.h > mindim)) {
            var res = splitRandomSquare(generator, cur)
            
            for (var j=0; j < res.length; j++) {
                var rsq = res[j]
                var area = rsq.w*rsq.h
                if ((generator.random() < randomaccept)||((area <= minarea)&&(area > 0))) {
                    ret.push(rsq)
                } else if (area > 0) {
                    sqs.push(rsq)
                }
            }
        } else {
            ret.push(cur)
        }
    }
    
    return ret
}

function iterateOverSquare(level, sq, fn) {
    for (var y=0; y < sq.h; y++) {
        var ty = sq.y + y
        
        if ((ty >= 0) && (ty < level.length)) {
            var row = level[ty]
            for (var x=0; x < sq.w; x++) {
                var tx = sq.x + x
                
                if ((tx >= 0) && (tx < row.length)) {
                    fn(row[tx], tx, ty, x, y)
                }
            }
        }
    }
}

function generateCave(generator, level, sq, floor, wall, options) {
    if (!options) {
        options = {}
    }
    
    /*iterateOverSquare(level, sq, function(pix) {
        if (generator.random() < (options.probability || 0.4)) {
            pix.tile = wall
        } else {
            pix.tile = floor
        }
    })*/
    
    var rpSq = Array.apply(null, new Array(sq.h)).map(function(){
        return new Array(sq.h)
    })
    iterateOverSquare(level, sq, function(pix, x, y, sx, sy) {
        if (generator.random() < (options.probability || 0.4)) {
            rpSq[sy][sx] = wall
        } else {
           rpSq[sy][sx] = floor
        }
        //rpSq[sy][sx] = pix.tile
    })
    
    for (var i=0; i < (options.iterations || 5); i++) {
        iterateOverSquare(level, sq, function(pix, x, y, sx, sy) {
            var w00 = 0, w01 = 0, w02 = 0, w10 = 0, w11 = 0, w12 = 0, w20 = 0, w21 = 0, w22 = 0
            
            var safeL = (x > 0)
            var safeR = (x < level[y].length - 1)
            
            var safeT = (y > 0)
            var safeB = (y < level.length - 1)
            
            if (safeL && safeT) {
                w00 = (level[y-1][x-1].tile == wall)?1:0
            }
            
            if (safeT) {
                w01 = (level[y-1][x].tile == wall)?1:0
            }
            
            if (safeR && safeT) {
                w02 = (level[y-1][x+1].tile == wall)?1:0
            }
            
            if (safeL) {
                w10 = (level[y][x-1].tile == wall)?1:0
            }
            
            w11 = (level[y][x].tile == wall)?1:0
            
            if (safeR) {
                w12 = (level[y][x+1].tile == wall)?1:0
            }
            
            if (safeL && safeB) {
                w20 = (level[y+1][x-1].tile == wall)?1:0
            }
            
            if (safeB) {
                w21 = (level[y+1][x].tile == wall)?1:0
            }
            
            if (safeR && safeB) {
                w22 = (level[y+1][x+1].tile == wall)?1:0
            }
            
            if ((w00 + w01 + w02 + w10 + w11 + w12 + w20 + w21 + w22) >= (options.caveness || 5)) {
                rpSq[sy][sx] = wall
            } else if (generator.random() < 0.2) {
                rpSq[sy][sx] = floor
            }
        })
        
        iterateOverSquare(level, sq, function(pix, x, y, sx, sy) {
            var shouldDraw = true
            
            if (options.noFloor && (rpSq[sy][sx] == floor)) {
                shouldDraw = false
            }
                
            if (shouldDraw) {
                pix.tile = rpSq[sy][sx]
                pix.cssClass = (pix.tile == floor)?(options.floorClass || "dirt"):(options.wallClass || "dirt")
                
                if ((pix.tile == wall) && (options.wallDamage)) {
                    pix.damage = options.wallDamage
                } else if ("damage" in pix) {
                    delete pix.damage
                }
            }
        })
    }
}

function drawSquareWalls(level, sq, wall, floor, cls) {
    var defIntensity = 3
    
    for (var y=0; y < sq.h; y++) {
        var row = level[sq.y + y]
        
        if ((y > 0)&&(y < sq.h-1)) {
            if (floor) {
                for (var x=1; x < sq.w; x++) {
                    var tl = row[x + sq.x]
                    tl.tile = floor
                    if (cls) {
                        tl.cssClass = cls
                    } else if ("cssClass" in tl){
                        delete tl.cssClass
                    }
                    
                    if (((y % 8) == 2) && ((x % 8) == 2) && (y < sq.h-2) && (x < sq.w-1)) {
                       //tl.lightsource = {intensity: defIntensity, color: [235, 235, 228]}
                       lightmanager.newLightSource({x: x + sq.x, y: sq.y + y}, defIntensity, [235, 235, 228])
                    }
                    
                    if ("damage" in tl) {
                        delete tl.damage
                    }
                }
            }
        } else {
            for (var x=1; x < sq.w; x++) {
                var tl = row[x + sq.x]
                
                tl.tile = wall
                if ((x % 8) == 1) {
                    lightmanager.newLightSource({x: x + sq.x, y: sq.y + y}, defIntensity, [235, 235, 228])
                    //tl.lightsource = {intensity: defIntensity, color: [235, 235, 228]}
                }
                if (cls) {
                    tl.cssClass = cls
                } else if ("cssClass" in tl){
                    delete tl.cssClass
                }
                
                if ("damage" in tl) {
                    delete tl.damage
                }
            }
        }
        
        var tl = row[sq.x]
        tl.tile = wall
        
        if ((y % 8) == 1) {
            //tl.lightsource = {intensity: defIntensity, color: [235, 235, 228]}
            lightmanager.newLightSource({x: x + sq.x, y: sq.y + y}, defIntensity, [235, 235, 228])
        }
        
        if (cls) {
            tl.cssClass = cls
        } else if ("cssClass" in tl){
            delete tl.cssClass
        }
        
        if ("damage" in tl) {
            delete tl.damage
        }

        tl = row[sq.x + sq.w - 1]
        tl.tile = wall
        if ((y % 8) == 1) {
            //tl.lightsource = {intensity: defIntensity, color: [235, 235, 228]}
            lightmanager.newLightSource({x: x + sq.x, y: sq.y + y}, defIntensity, [235, 235, 228])
        }
        if (cls) {
            tl.cssClass = cls
        } else if ("cssClass" in tl){
            delete tl.cssClass
        }
        
        if ("damage" in tl) {
            delete tl.damage
        }
    }
}

function drawSquareDoors(generator, level, sq, door, cntDoors) {
    for (var j=0; j < cntDoors; j++) {
        var x = Math.floor(generator.random() * (sq.w-2)) + 1
        var y = Math.floor(generator.random() * (sq.h-2)) + 1
        var orientation = Math.floor(generator.random() * 4)
        
        switch (orientation) {
            case 0: {
                if (sq.x > 0) {
                    x = 0
                } else if ((sq.x + sq.w) < (level[0].length - 1)) {
                    x = sq.w - 1
                } else {
                    continue
                }
                break;
            }
            case 1: {
                if ((sq.x + sq.w) < (level[0].length - 1)) {
                    x = sq.w - 1
                } else if (sq.x > 0) {
                    x = 0
                } else {
                    continue
                }
                break;
            }
            case 2: {
                if (sq.y > 0) {
                    y = 0
                } else if ((sq.y + sq.h) < (level.length - 1)) {
                    y = sq.h - 1
                } else {
                    continue
                }
                break;
            }
            case 3: {
                if ((sq.y + sq.h) < (level.length - 1)) {
                    y = sq.h - 1
                } else if (sq.y > 0) {
                    y = 0
                } else {
                    continue
                }
                break;
            }
        }
        
        try {
            level[sq.y + y][sq.x + x].tile = door
        } catch (e) {
            console.log("Exception on " + (sq.x + x) + "," + (sq.y + y))
            console.log(sq)
            throw e
        }
    }
}

function bspSquares(generator, level, minarea, randomaccept, floor, wall, door, probabilityUsed, caveness) {
    probabilityUsed = probabilityUsed || 1
    var sqs = calcBspSquares(generator, level, minarea, randomaccept)
    caveness = caveness || 0
    
    for (var i=0; i < sqs.length; i++) {
        var sq = sqs[i]
        
        if ((probabilityUsed >= 1) || (generator.random() < probabilityUsed)) {
            sq.used = true
        }
        
        if (generator.random() < caveness) {
            sq.cave = true
        }
        
        // Put the walls
        if (sq.used && !sq.cave) {
            drawSquareWalls(level, sq, wall)
        }
    }

    for (var i=0; i < sqs.length; i++) {
        var sq = sqs[i]
        // Now put some doors
        if (sq.used) {
            if (sq.cave) {
                generateCave(generator, level, sqs[i], floor, wall)
            } else {
                /*var cntDoors = Math.round(generator.random() * 6) + 1
                drawSquareDoors(generator, level, sq, door, cntDoors)*/
                
                drawRoom(generator, level, sq, wall, floor, door)
            }
        }
    }
}

function riverH(generator, level, riverTile, riverCssClass, bridgeTile, bridgeCssClass, riverDamage, light) {
    var w = level[0].length
    var h = level.length
    
    var rh = Math.floor(generator.random() * 6) + 3
    var rc = Math.floor(generator.random() * h)
    var nbridge = 0
    var bridgeDrawn = false
    var nyvar = Math.floor(generator.random() * 5) + 3
    
    if ((typeof(riverDamage) == "undefined") || (riverDamage == null)) {
        riverDamage = false
    }
    
    for (var x=0; x < w; x++) {
        
        if ((generator.random()<0.05) && (!bridgeDrawn)) {
            nbridge = Math.floor(generator.random() * 4) + 2
        }
        
        for (var y=0; y < rh; y++) {
            if ((y + rc >= 0) && (y + rc < h)) {
                var tile = level[y+rc][x]
                
                if (nbridge > 0) {
                    tile.tile = bridgeTile
                    tile.cssClass = bridgeCssClass
                    
                    if ("damage" in tile) {
                        delete tile.damage
                    }
                } else {
                    tile.tile = riverTile
                    tile.cssClass = riverCssClass
                    if (light) {
                        tile.lightsource = [light]
                    }
                    if (riverDamage) {
                        tile.damage = riverDamage
                    } else if ("damage" in tile) {
                        delete tile.damage
                    }
                }
            }
        }
        
        nbridge--
        if ((x % nyvar) == 0) {
            rc += Math.round(generator.random() * 2 - 1)
            rh += Math.round(generator.random() * 2 - 1)
            if (rh < 1) {
                rh = 1
            }
        }
    }
}

function riverV(generator, level, riverTile, riverCssClass, bridgeTile, bridgeCssClass, riverDamage, light) {
    var w = level[0].length
    var h = level.length
    
    var rw = Math.floor(generator.random() * 6) + 3
    var rc = Math.floor(generator.random() * w)
    var nbridge = 0
    var bridgeDrawn = false
    var nxvar = Math.floor(generator.random() * 5) + 3
    
    if ((typeof(riverDamage) == "undefined") || (riverDamage == null)) {
        riverDamage = false
    }
    
    for (var y=0; y < h; y++) {
        
        if ((generator.random()<0.05) && (!bridgeDrawn)) {
            nbridge = Math.floor(generator.random() * 4) + 2
        }
        
        for (var x=0; x < rw; x++) {
            if ((x + rc >= 0) && (x + rc < w)) {
                var tile = level[y][x+rc]
                
                if (nbridge > 0) {
                    tile.tile = bridgeTile
                    tile.cssClass = bridgeCssClass
                    
                    if ("damage" in tile) {
                        delete tile.damage
                    }
                } else {
                    tile.tile = riverTile
                    tile.cssClass = riverCssClass
                    if (light) {
                        tile.lightsource = [light]
                    }
                    if (riverDamage) {
                        tile.damage = riverDamage
                    } else if ("damage" in tile) {
                        delete tile.damage
                    }
                }
            }
        }
        
        nbridge--
        if ((y % nxvar) == 0) {
            rc += Math.round(generator.random() * 2 - 1)
            rw += Math.round(generator.random() * 2 - 1)
            if (rw < 1) {
                rw = 1
            }
        }
    }
}

function river(generator, level, orientation, riverTile, riverCssClass, bridgeTile, bridgeCssClass, riverDamage, light) {
    if (orientation == "horizontal") {
        riverH(generator, level, riverTile, riverCssClass, bridgeTile, bridgeCssClass, riverDamage, light)
    } else if (orientation == "vertical") {
        riverV(generator, level, riverTile, riverCssClass, bridgeTile, bridgeCssClass, riverDamage, light)
    }
}

function countDirt(level, sq, floor) {
    var cnt = 0
    for (var y=0; y < sq.h; y++) {
        var row = level[sq.y + y]
        
        for (var x=0; x < sq.w; x++) {
            var tile = row[sq.x + x]
            
            if (tile.tile != floor) {
                cnt += 1
            }
        }
    }
    
    return cnt
}

function squareCollidesWithRooms(sq, rooms) {
    var collides = false
    
    for (var i=0; i < rooms.length; i++) {
        var osq = rooms[i]
        
        collides |= !(
            ((sq.y + sq.h) < osq.y) ||
            (sq.y > (osq.y + osq.h)) ||
            (sq.x > (osq.x + osq.w)) ||
            ((sq.x + sq.w) < osq.x) )
            
        if (collides) {
            break
        }
    }
    
    return collides
}

function expandAsPossibleStep(generator, level, sq, floor, curCnt, maxCnt, rooms) {
    var sq_xl = {x: sq.x - 1, y: sq.y, w: sq.w + 1, h: sq.h}
    var sq_xr = {x: sq.x, y: sq.y, w: sq.w + 1, h: sq.h}
    var sq_yt = {x: sq.x, y: sq.y - 1, w: sq.w, h: sq.h + 1}
    var sq_yb = {x: sq.x, y: sq.y, w: sq.w, h: sq.h + 1}
    
    var cnt_xl, cnt_xr, cnt_yt, cnt_yb
    var sqs = [sq, sq_xl, sq_xr, sq_yt, sq_yb]
    var curmin = 0
    var curCnt = maxCnt
    
    var evalFns = [function () {
            if (squareCollidesWithRooms(sq_xl, rooms)) {
                return
            }
            
            if (sq.x > 0) {
                var cnt = countDirt(level, sq_xl, floor)
                if ((cnt < maxCnt) && (cnt < curCnt)) {
                    curCnt = cnt
                    curmin = 1
                }
            }
        },
        function () {
            if (squareCollidesWithRooms(sq_xr, rooms)) {
                return
            }
            
            if ((sq.x + sq.w) < (level[0].length - 1)) {
                cnt = countDirt(level, sq_xr, floor)
                if (cnt < curCnt) {
                    curCnt = cnt
                    curmin = 2
                }
            }
        },
        
        function () {
            if (squareCollidesWithRooms(sq_yt, rooms)) {
                return
            }
            
            if (sq.y > 0) {
                cnt = countDirt(level, sq_yt, floor)
                if (cnt < curCnt) {
                    curCnt = cnt
                    curmin = 3
                }
            }
        },
        
        function () {
            if (squareCollidesWithRooms(sq_yb, rooms)) {
                return
            }
            
            if ((sq.y + sq.h) < (level.length - 1)) {
                cnt = countDirt(level, sq_yb, floor)
                if (cnt < curCnt) {
                    curCnt = cnt
                    curmin = 4
                }
            }
        }]
    while (evalFns.length > 0) {
        var p = Math.floor(generator.random() * evalFns.length)
        evalFns[p]()
        evalFns.splice(p, 1)
    }
    
    return [sqs[curmin], curCnt]
}

function equalSquare(sq0, sq1) {
    return (sq0.x == sq1.x) && (sq0.y == sq1.y) && (sq0.w == sq1.w) && (sq0.h == sq1.h)
}

function expandAsPossible(generator, level, sq, floor, curCnt, maxDirt, rooms) {
    var mustTry = true
    
    while (mustTry) {
        var res = expandAsPossibleStep(generator, level, sq, floor, curCnt, maxDirt, rooms)
        if ((res[1] < maxDirt) && (!equalSquare(sq, res[0]))) {
            curCnt = res[1]
            sq = res[0]
        } else {
            mustTry = false
        }
    }
    
    return sq
}

function caveLevel(generator, level, minarea, randomaccept, floor, wall, door, probabilityUsed, caveness) {
    generateCave(generator, level, {x: 0, y:0, w: level[0].length, h: level.length}, floor, wall, {
        iterations: 11
    })
    
    var rooms = []
    var lw = level[0].length
    var lh = level.length
    var numRooms = Math.floor(generator.random() * 10)
    for (var i=0; i < numRooms; i++) {
        var tries = 0
        var numDirt = 0
        var maxDirt = 40
        
        while (tries < 50) {
            var x = Math.floor(generator.random() * lw)
            var y = Math.floor(generator.random() * lh)
            var w = 1
            var h = 1
            var sq = {x: x, y: y, w: w, h: h}
            
            var cnt = countDirt(level, sq, floor)
            if (cnt == 0) {
                sq = expandAsPossible(generator, level, sq, floor, cnt, maxDirt, rooms)
                
                if ((((sq.w-2) * (sq.h - 2)) >= minarea) || (generator.random() < randomaccept)) {
                    drawRoom(generator, level, sq, wall, floor, door)
                    rooms.push(sq)
                    tries = 1000
                }
            }
            
            tries += 1
        }
    }
}

function lavaLevel(generator, level, minarea, randomaccept, floor, wall, door, lava, lavaDamage, probabilityUsed, caveness) {
    generateCave(generator, level, {x: 0, y:0, w: level[0].length, h: level.length}, floor, wall, {
        noFloor: true,
        wallClass: "dirt",
        iterations: 12
    })
    
    generateCave(generator, level, {x: 0, y:0, w: level[0].length, h: level.length}, floor, lava, {
        floorClass: "dirt",
        wallClass: "lava",
        wallDamage: lavaDamage,
        iterations: 12
    })
    
    var rooms = []
    var lw = level[0].length
    var lh = level.length
    var numRooms = Math.floor(generator.random() * 10)
    for (var i=0; i < numRooms; i++) {
        var tries = 0
        var numDirt = 0
        var maxDirt = 40
        
        while (tries < 50) {
            var x = Math.floor(generator.random() * lw)
            var y = Math.floor(generator.random() * lh)
            var w = 1
            var h = 1
            var sq = {x: x, y: y, w: w, h: h}
            
            if (!squareCollidesWithRooms(sq, rooms)) {
                var cnt = countDirt(level, sq, floor)
                if (cnt == 0) {
                    sq = expandAsPossible(generator, level, sq, floor, cnt, maxDirt, rooms)
                    
                    if ((((sq.w-2) * (sq.h - 2)) >= minarea) || (generator.random() < randomaccept)) {
                        drawRoom(generator, level, sq, wall, floor, door)
                        rooms.push(sq)
                        tries = 1000
                    }
                }
            }
            
            tries += 1
        }
    }
    
    level.map(function(row, y) {
        return row.map(function(tile, x) {
            if (tile.tile == lava) {
                lightmanager.newLightSource({x: x, y: y}, 2, [32, 0, 0])
            }
            
            return tile
        })
    })
}

function findFittingRoom(generator, w, h) {
    var possibleRooms = []
    for (n in prebuiltRooms) {
        if (prebuiltRooms.hasOwnProperty(n)) {
            var room = prebuiltRooms[n]
            var layer = room.sprite.layers[0]
            
            if ((layer.width == w) && (layer.height == h)) {
                possibleRooms.push(room)
            }
        }
    }
    
    if (possibleRooms.length > 0) {
        return possibleRooms[generator.randomInt(possibleRooms.length)]
    }
}

function drawRoom(generator, level, sq, wall, floor, door) {
    var cntDoors = Math.floor(generator.random() * 6) + 1
    
    var room = findFittingRoom(generator, sq.w, sq.h)
    
    if (room) {
        room.sprite.draw(level, sq.x, sq.y)
        
        if (room.autoDoorsOnBorder) {
            drawSquareDoors(generator, level, sq, door, cntDoors)
        }
    } else {
        drawSquareWalls(level, sq, wall, floor)
        drawSquareDoors(generator, level, sq, door, cntDoors)
    }
}

function drawSpecificRoom(level, x, y, name) {
    var room = prebuiltRooms[name]
    
    if (room) {
        room.sprite.draw(level, x, y)
    }
}

function testLevel(generator, level, floor, wall, door) {
    drawRoom(generator, level, {x: 0, y: 0, w: level[0].length, h: level.length}, wall, floor, door)
    
    drawRoom(generator, level, {x: 10, y: 10, w: 20, h: 1}, wall, floor, door)
    
    drawRoom(generator, level, {x: 30, y: 30, w: 1, h: 20}, wall, floor, door)
    
    drawSpecificRoom(level, 10, 20, "middleplatecompactrap")
    
    drawSpecificRoom(level, 10, 45, "spikedaltar")
    drawSpecificRoom(level, 30, 45, "containeditems")
    drawSpecificRoom(level, 10, 54, "fireballstation")
    drawSpecificRoom(level, 35, 40, "northturret")
    drawSpecificRoom(level, 15, 40, "itemprinter")
    
    
    drawSpecificRoom(level, 50, 20, "compactor")
}

module.exports = {
    bspSquares: bspSquares,
    caveLevel: caveLevel,
    lavaLevel: lavaLevel,
    river: river,
    testLevel: testLevel
}