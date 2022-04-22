"use strict";
exports.__esModule = true;
var typescript = require("typescript");
var path = require("path");
var transformer = function (_) { return function (transformationContext) { return function (sourceFile) {
    function visitNode(node) {
        if (shouldMutateModuleSpecifier(node)) {
            if (typescript.isImportDeclaration(node)) {
                var newModuleSpecifier = typescript.createLiteral("".concat(node.moduleSpecifier.text, ".js"));
                return typescript.updateImportDeclaration(node, node.decorators, node.modifiers, node.importClause, newModuleSpecifier, undefined);
            }
            else if (typescript.isExportDeclaration(node)) {
                var newModuleSpecifier = typescript.createLiteral("".concat(node.moduleSpecifier.text, ".js"));
                return typescript.updateExportDeclaration(node, node.decorators, node.modifiers, node.exportClause, newModuleSpecifier, false);
            }
        }
        return typescript.visitEachChild(node, visitNode, transformationContext);
    }
    function shouldMutateModuleSpecifier(node) {
        if (!typescript.isImportDeclaration(node) && !typescript.isExportDeclaration(node))
            return false;
        if (node.moduleSpecifier === undefined)
            return false;
        // only when module specifier is valid
        if (!typescript.isStringLiteral(node.moduleSpecifier))
            return false;
        // only when path is relative
        if (!node.moduleSpecifier.text.startsWith('./') && !node.moduleSpecifier.text.startsWith('../'))
            return false;
        // only when module specifier hasn't specific extensions or has no extension
        if (['.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.json', '.css', '.less', '.htm', '.html', '.scss', '.sass'].includes(path.extname(node.moduleSpecifier.text)) === true ||
            (path.extname(node.moduleSpecifier.text) !== '' && path.extname(node.moduleSpecifier.text).length <= 4))
            return false;
        return true;
    }
    return typescript.visitNode(sourceFile, visitNode);
}; }; };
exports["default"] = transformer;
