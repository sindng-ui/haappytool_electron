using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace RxFlow.Validator
{
    class Program
    {
        static void Main(string[] args)
        {
            // Read source code from Stdin (or file if argument provided)
            string sourceCode = "";
            if (args.Length > 0 && File.Exists(args[0]))
            {
                sourceCode = File.ReadAllText(args[0]);
            }
            else
            {
                // Read from Stdin
                using (var reader = new StreamReader(Console.OpenStandardInput()))
                {
                    sourceCode = reader.ReadToEnd();
                }
            }

            if (string.IsNullOrWhiteSpace(sourceCode))
            {
                Console.WriteLine("[]"); // No errors
                return;
            }

            var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode);
            var compilation = CSharpCompilation.Create("RxStream")
                .AddReferences(
                    MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
                    MetadataReference.CreateFromFile(typeof(Console).Assembly.Location),
                    MetadataReference.CreateFromFile(typeof(Enumerable).Assembly.Location)
                )
                .AddSyntaxTrees(syntaxTree);

            // Just check Syntax Diagnostics first
            var diagnostics = syntaxTree.GetDiagnostics();
            
            // Should properly compile to check semantic errors too, but references are tricky in portable sidecar.
            // Let's stick to Syntax check for now unless configured.

            var results = diagnostics.Select(d => new ValidationResult
            {
                Id = d.Id,
                Message = d.GetMessage(),
                Line = d.Location.GetLineSpan().StartLinePosition.Line + 1,
                Severity = d.Severity.ToString()
            }).ToList();

            Console.WriteLine(JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
        }
    }

    public class ValidationResult
    {
        public string Id { get; set; }
        public string Message { get; set; }
        public int Line { get; set; }
        public string Severity { get; set; }
    }
}
