const path = require('path');
const webpack = require("webpack");
const { DuplicatesPlugin } = require("inspectpack/plugin");
const DtsBundleWebpack = require('dts-bundle-webpack')

const base = {
    entry: './src/web/index.ts',
    devtool: 'source-map',
    mode: "production",
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: path.resolve("./esm.tsconfig.json")
                    }
                }],
                exclude: [
                    /node_modules/,
                    path.resolve(__dirname, "src/node/"),
                    path.resolve(__dirname, "build/")
                ],
            },
        ],
    },
    // externals: /^@bundlr-network\/.*/,
    externals: {
        // "@bundlr-network/solana-web": "@bundlr-network/solana-web",
        // "@bundlr-network/ethereum-web": "@bundlr-network/ethereum-web",
        // "@bundlr-network/client": "BundlrClient",
        "arbundles": "arbundles",
        "arweave": "Arweave",
        "Buffer": "Buffer",
        "crypto": "Crypto",
        "stream": "stream",
        "path": "path",
        "zlib": "zlib"
    },
    resolve: {
        extensions: ['.ts', '.js'],
        // alias: {
        //     // process: "process/browser",
        //     // crypto: "crypto-browserify",
        //     // stream: "stream-browserify",
        // },
        // fallback: {
        //     // "crypto": require.resolve("crypto-browserify"),
        //     // "assert": require.resolve("assert/"),
        //     // "stream": require.resolve("stream-browserify"),
        //     // "process": require.resolve("process/browser"),
        //     // "util": require.resolve("util"),
        //     // "events": require.resolve("events/"),
        //     // "buffer": require.resolve('buffer/'),
        //     // "zlib": require.resolve("browserify-zlib"),
        //     // "path": require.resolve("path-browserify")
        // }
    },
    plugins: [
        new DtsBundleWebpack({
            name: "@bundlr-network/client",
            main: "./build/esm/index.d.ts"
        }),
        // new webpack.ProvidePlugin({
        //     arbundles: "arbundles"
        // }),
        new DuplicatesPlugin({
            emitErrors: false,
            verbose: false
        })
    ],

};
const mod = {
    ...base,
    externals: { ...base.externals },
    externalsType: 'global',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'build/esm/'),
        libraryTarget: "module",
        module: true
    },
    experiments: {
        outputModule: true,
    }
}
const umd = {
    ...base,
    externalsType: 'global',
    externals: { ...base.externals, "arbundles": "arbundles", },
    output: {
        filename: "umd.bundle.js",
        path: path.resolve(__dirname, 'build/esm/'),
        library: "BundlrClient",
        libraryTarget: "umd",
        globalObject: "globalThis",
        umdNamedDefine: true,
    }
}

module.exports = [mod, umd]