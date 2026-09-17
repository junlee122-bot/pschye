using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

class Program
{
    static int Main(string[] args)
    {
        var files = new List<object>();
        int errors = 0;
        foreach (var file in Directory.GetFiles(args[0], "*.cs", SearchOption.AllDirectories))
        {
            var text = File.ReadAllText(file);
            var options = new CSharpParseOptions(LanguageVersion.CSharp9, preprocessorSymbols: new[] { "UNITY_EDITOR", "UNITY_INCLUDE_TESTS", "ENABLE_LEGACY_INPUT_MANAGER" });
            var tree = CSharpSyntaxTree.ParseText(text, options, file);
            var found = tree.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error).Select(d => d.ToString()).ToArray();
            errors += found.Length;
            using var sha = SHA256.Create();
            var hash = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-", "").ToLowerInvariant();
            files.Add(new { file, sha256 = hash, errors = found });
        }
        var result = new { checkedAt = DateTime.UtcNow, kind = "Roslyn C# 9 syntax only; not Unity compilation, type checking or engine execution", fileCount = files.Count, errorCount = errors, files };
        File.WriteAllText(args[1], JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"C# syntax: {files.Count} files, {errors} errors. Unity compilation and execution not performed.");
        return errors == 0 ? 0 : 1;
    }
}
