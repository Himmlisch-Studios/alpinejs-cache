buildPlugin({
    entryPoints: ['builds/cdn.js'],
    outfile: 'dist/cache.min.js',
})

buildPlugin({
    entryPoints: ['builds/module.js'],
    outfile: 'dist/cache.esm.js',
    platform: 'neutral',
    mainFields: ['main', 'module'],
})

/** @param {import('esbuild').BuildOptions} buildOptions  */
function buildPlugin(buildOptions) {
    return require('esbuild').buildSync({
        ...buildOptions,
        minify: true,
        bundle: true,
    })
}
