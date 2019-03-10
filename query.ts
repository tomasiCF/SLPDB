import { Config } from "./config";
import { SlpTransactionDetails, SlpTransactionType } from "slpjs";
import BigNumber from "bignumber.js";

const bitqueryd = require('fountainhead-bitqueryd')

export class Query {

    static dbQuery: any; 
    //constructor(){}
    static async init(): Promise<void> {
        if(!Query.dbQuery) { 
            Query.dbQuery = await bitqueryd.init({ url: Config.db.url, name: Config.db.name });
        }
        return Query.dbQuery;
    }

    static async queryForRecentTokenTxns(tokenId: string, block: number): Promise<string[]> {
        let q = {
            "v": 3,
            "q": {
                "find": { "out.h1": "534c5000", "out.h4": tokenId, "$or": [{ "blk.i": { "$gte": block } }, { "blk.i": null } ]  }
            },
            "r": { "f": "[ .[] | { txid: .tx.h } ]" }
        }

        let res: TxnQueryResponse = await this.dbQuery.read(q);
        let response = new Set<any>([].concat(<any>res.c).concat(<any>res.u).map((r: any) => { return r.txid } ));
        return Array.from(response);
    }

    static async queryTokensList(): Promise<SlpTransactionDetails[]> {
        let q = {
            "v": 3,
            "q": {
              "find": { "out.h1": "534c5000", "out.s3": "GENESIS" },
              "limit": 10000,
            },
            "r": { "f": "[ .[] | { tokenIdHex: .tx.h, versionTypeHex: .out[0].h2, timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end), symbol: .out[0].s4, name: .out[0].s5, documentUri: .out[0].s6, documentSha256Hex: .out[0].h7, decimalsHex: .out[0].h8, batonHex: .out[0].h9, quantityHex: .out[0].h10 } ]" }
        }

        let response: GenesisQueryResult | any = await this.dbQuery.read(q);
        let tokens: GenesisQueryResult[] = [].concat(response.u).concat(response.c);
        return tokens.map(t => this.mapSlpTokenDetailsFromQuery(t));
    }

    static async queryTokenDetails(tokenIdHex: string): Promise<SlpTransactionDetails|null> {
        let q = {
            "v": 3,
            "q": {
                "find": { "tx.h": tokenIdHex, "out.h1": "534c5000", "out.s3": "GENESIS" }
            },
            "r": { "f": "[ .[] | { tokenIdHex: .tx.h, versionTypeHex: .out[0].h2, timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end), symbol: .out[0].s4, name: .out[0].s5, documentUri: .out[0].s6, documentSha256Hex: .out[0].h7, decimalsHex: .out[0].h8, batonHex: .out[0].h9, quantityHex: .out[0].h10 } ]" }
        }

        let response: GenesisQueryResult | any = await this.dbQuery.read(q);
        let tokens: GenesisQueryResult[] = [].concat(response.u).concat(response.c);
        return tokens.length > 0 ? tokens.map(t => this.mapSlpTokenDetailsFromQuery(t))[0] : null;
    }

    static mapSlpTokenDetailsFromQuery(res: GenesisQueryResult): SlpTransactionDetails {
        let baton: number = parseInt(res.batonHex, 16);
        let qtyBuf = Buffer.from(res.quantityHex, 'hex');
        let qty: BigNumber = (new BigNumber(qtyBuf.readUInt32BE(0).toString())).multipliedBy(2**32).plus(qtyBuf.readUInt32BE(4).toString())
        return {
            tokenIdHex: res.tokenIdHex,
            timestamp: <string>res.timestamp,
            transactionType: SlpTransactionType.GENESIS,
            versionType: parseInt(res.versionTypeHex, 16),
            documentUri: res.documentUri,
            documentSha256: Buffer.from(res.documentSha256Hex, 'hex'),
            symbol: res.symbol, 
            name: res.name, 
            batonVout: baton,
            decimals: parseInt(res.decimalsHex, 16),
            containsBaton: baton > 1 && baton < 256 ? true : false,
            genesisOrMintQuantity: qty
        }
    }

    static async queryForTxoInput(txid: string, vout: number): Promise<TxnQueryResult> {
        let q = {
            "v": 3,
            "q": {
                "find": { 
                    "in": {
                        "$elemMatch": { "e.h": txid, "e.i": vout }
                    }
                }   
            },
            "r": { "f": "[ .[] | { txid: .tx.h, block: (if .blk? then .blk.i else null end), timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end), tokenid: .out[0].h4, slp1: .out[0].h5, slp2: .out[0].h6, slp3: .out[0].h7, slp4: .out[0].h8, slp5: .out[0].h9, slp6: .out[0].h10, slp7: .out[0].h11, slp8: .out[0].h12, slp9: .out[0].h13, slp10: .out[0].h14, slp11: .out[0].h15, slp12: .out[0].h16, slp13: .out[0].h17, slp14: .out[0].h18, slp15: .out[0].h19, slp16: .out[0].h20, slp17: .out[0].h21, slp18: .out[0].h22, slp19: .out[0].h23, bch0: .out[0].e.v, bch1: .out[1].e.v, bch2: .out[2].e.v, bch3: .out[3].e.v, bch4: .out[4].e.v, bch5: .out[5].e.v, bch6: .out[6].e.v, bch7: .out[7].e.v, bch8: .out[8].e.v, bch9: .out[9].e.v, bch10: .out[10].e.v, bch11: .out[11].e.v, bch12: .out[12].e.v, bch13: .out[13].e.v, bch14: .out[14].e.v, bch15: .out[15].e.v, bch16: .out[16].e.v, bch17: .out[17].e.v, bch18: .out[18].e.v, bch19: .out[19].e.v } ]" }
        }

        let response: TxnQueryResponse = await this.dbQuery.read(q);
        
        if(!response.errors) {
            let results: TxnQueryResult[] = ([].concat(<any>response.c).concat(<any>response.u));
            if(results.length === 1) {
                let res: any = results[0];
                let sendOutputs: { tokenQty: BigNumber, satoshis: number }[] = [];
                res.sendOutputs = sendOutputs;
                res.sendOutputs.push({ tokenQty: new BigNumber(0), satoshis: res.bch0 });
                let keys = Object.keys(res);
                keys.forEach((key, index) => {
                    if(res[key] && key.includes('slp')) {
                        try {
                            let qtyBuf = Buffer.from(res[key], 'hex');
                            res.sendOutputs.push({ tokenQty: (new BigNumber(qtyBuf.readUInt32BE(0).toString())).multipliedBy(2**32).plus(new BigNumber(qtyBuf.readUInt32BE(4).toString())), satoshis: res["bch" + key.replace('slp', '')] });
                        } catch(err) { 
                            throw err;
                        }
                    }
                })
                return res;
            }
            else {
                console.log("Assumed Token Burn: Could not find the spend transaction: " + txid + ":" + vout);
                return { tokenid: null, txid: null, block: null, timestamp: null, sendOutputs: [ { tokenQty: new BigNumber(0), satoshis: 0} ] }
            }
        }
        throw Error("Mongo DB ERROR.")
    }

    static async getTransactionDetails(txid: string): Promise<{ block: number|null, timestamp: string|null} |null> {
        let q = {
            "v": 3,
            "q": {
                "find": { "tx.h": txid }
            },
            "r": { "f": "[ .[] | { block: (if .blk? then .blk.i else null end), timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end) } ]" }
        }

        let res: TxnQueryResponse = await Query.dbQuery.read(q);
        
        if(!res.errors) {
            let results: { block: number|null, timestamp: string|null}[] = [];
            results = [ ...([].concat(<any>res.c).concat(<any>res.u))]
            if(results.length > 0) {
                return results[0];
            }
        }
        return null;
    }

    static async getMintTransactions(tokenId: string): Promise<MintQueryResult[]|null> {
        let q = {
            "v": 3,
            "q": {
                "find": { "out.h1": "534c5000", "out.s3": "MINT", "out.h4": tokenId }
            },
            "r": { "f": "[ .[] | { txid: .tx.h, versionTypeHex: .out[0].h2, block: (if .blk? then .blk.i else null end), timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end), batonHex: .out[0].h5, quantityHex: .out[0].h6 } ]" }
        }

        let res: TxnQueryResponse = await Query.dbQuery.read(q);
        
        if(!res.errors) {
            let results: MintQueryResult[] = [];
            [ ...([].concat(<any>res.c).concat(<any>res.u))].forEach((res: MintQueryResult) => {
                let i = results.findIndex(r => r.txid === res.txid);
                if(i <= -1)
                    results.push(res);
            });
            if(results.length > 0) {
                return results;
            }
        }
        return null;
    }
}

export interface TxnQueryResponse {
    c: TxnQueryResult[],
    u: TxnQueryResult[], 
    errors?: any;
}


export interface GenesisQueryResult {
    tokenIdHex: string;
    versionTypeHex: string;
    timestamp: string|null;
    symbol: string;
    name: string;
    documentUri: string;
    documentSha256Hex: string; 
    decimalsHex: string;
    batonHex: string;
    quantityHex: string;
}


export interface MintQueryResult {
    txid: string|null;
    block: number|null;
    timestamp: string|null;
    batonHex: string|null;
    quantityHex: string|null;
    versionTypeHex: string|null;
}

export interface TxnQueryResult {
    sendOutputs: { tokenQty: BigNumber, satoshis: number }[];
    //input: {h: string, i: number, a: string };
    txid: string|null;
    block: number|null;
    timestamp: string|null;
    tokenid: string|null,
    bch0?: number;
    bch1?: number|null;
    bch2?: number|null;
    bch3?: number|null;
    bch4?: number|null;
    bch5?: number|null;
    bch6?: number|null;
    bch7?: number|null;
    bch8?: number|null;
    bch9?: number|null;
    bch10?: number|null;
    bch11?: number|null;
    bch12?: number|null;
    bch13?: number|null;
    bch14?: number|null;
    bch15?: number|null;
    bch16?: number|null;
    bch17?: number|null;
    bch18?: number|null;
    bch19?: number|null;
    slp0?: number;
    slp1?: number|null;
    slp2?: number|null;
    slp3?: number|null;
    slp4?: number|null;
    slp5?: number|null;
    slp6?: number|null;
    slp7?: number|null;
    slp8?: number|null;
    slp9?: number|null;
    slp10?: number|null;
    slp11?: number|null;
    slp12?: number|null;
    slp13?: number|null;
    slp14?: number|null;
    slp15?: number|null;
    slp16?: number|null;
    slp17?: number|null;
    slp18?: number|null;
    slp19?: number|null;
}