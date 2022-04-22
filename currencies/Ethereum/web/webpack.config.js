const path = require("path");
const webpack = require("webpack");
const { DuplicatesPlugin } = require("inspectpack/plugin");

const base = {
    entry: "./index.ts",
    mode: "production",
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: "ts-loader",
                    options: {
                        configFile: path.resolve("./esm.json")
                    }
                }],
                exclude: [
                    /node_modules/,
                    path.resolve(__dirname, "esm/"),
                    path.resolve(__dirname, "cjs/")
                ],
            },
        ],
    },
    externals: {
        "Buffer": "Buffer",
        "crypto": "Crypto",
        "stream": "stream",
    },
    externalsType: "global",
    resolve: {
        extensions: [".ts", ".js"],
    },
    plugins: [
        new DuplicatesPlugin({
            emitErrors: false,
            verbose: false
        })
    ],

};


const mod = {
    ...base,
    externals: {
        ...base.externals,
        "arbundles": "arbundles",
    },
    output: {
        filename: "esm.bundle.js",
        path: path.resolve(__dirname, "esm/web"),
        libraryTarget: "module",
        umdNamedDefine: true
    },
    experiments: {
        outputModule: true,
    }
}
const umd = {
    ...base,
    externals: {
        ...base.externals,
        "arbundles": "arbundles",
    },
    output: {
        filename: "umd.bundle.js",
        path: path.resolve(__dirname, "esm/web"),
        library: "BundlrEthereumWeb",
        libraryTarget: "umd",
        globalObject: "globalThis",
        umdNamedDefine: true,
    }
}
const aio = {
    ...base,
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "esm/web"),
        libraryTarget: "module",
        umdNamedDefine: true
    },
    resolve: {
        ...base.resolve,
        fallback: {
            "zlib": false,
            "path": false
        }
    },
    experiments: {
        outputModule: true,
    }
}

module.exports = [mod, umd, aio]