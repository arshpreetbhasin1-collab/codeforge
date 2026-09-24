-- CodeForge — Development Seed Data
--
-- Small, original fixtures only. Not a content catalog — this is a real
-- but intentionally bounded Foundations curriculum (Python), not the full
-- product catalog. Nothing here is copied from LeetCode or any other
-- problem source; all statements, examples, and wording are original.
--
-- Verified by actually applying this file (plus db/schema/*.sql) to a real
-- local PostgreSQL instance before committing — see the Prompt 2 report
-- for how. Do not assume a large seed file like this is correct by
-- inspection alone; re-verify the same way after editing it.

-- ---------------------------------------------------------------------
-- Languages
-- ---------------------------------------------------------------------
insert into languages (slug, display_name, version, file_extension, syntax_highlighter, execution_provider, run_command, timeout_ms, memory_limit_mb, enabled, sort_order, provider_language_id, execution_enabled)
values
  ('python', 'Python', '3.12', '.py', 'python', 'wandbox', 'python3 main.py', 5000, 256, true, 1, 'cpython-3.12.7', true),
  ('javascript', 'JavaScript', 'Node 22', '.js', 'javascript', 'sandboxed_container', 'node main.js', 5000, 256, true, 2, null, false),
  ('java', 'Java', '21', '.java', 'java', 'wandbox', 'java prog', 8000, 512, true, 3, 'openjdk-jdk-21+35', true),
  ('c', 'C', 'GCC 13.2.0', '.c', 'c', 'wandbox', './prog', 5000, 256, true, 4, 'gcc-13.2.0-c', true),
  ('cpp', 'C++', 'GCC 13.2.0', '.cpp', 'cpp', 'wandbox', './prog', 5000, 256, true, 5, 'gcc-13.2.0', true),
  ('sql', 'SQL', 'PostgreSQL', '.sql', 'sql', 'sql_sandbox', 'isolated transaction', 2000, 64, true, 6, null, true);

-- ---------------------------------------------------------------------
-- Skills (20) — Skill Graph nodes
-- ---------------------------------------------------------------------
insert into skills (slug, name, description, category, difficulty) values
  ('variables', 'Variables', 'Storing and naming values in memory.', 'foundations', 1),
  ('data-types', 'Data Types', 'The kinds of values a language can represent and how they behave.', 'foundations', 1),
  ('operators', 'Operators', 'Combining and comparing values with arithmetic, comparison, and logical operators.', 'foundations', 1),
  ('input-output', 'Input / Output', 'Reading input into a program and printing results back out.', 'foundations', 1),
  ('control-flow', 'Control Flow', 'Directing execution with if/else and loops.', 'control_flow', 1),
  ('functions', 'Functions', 'Packaging logic into reusable, named units.', 'functions', 1),
  ('scope', 'Scope', 'Where a variable name is visible and how long it lives.', 'functions', 2),
  ('arrays', 'Arrays', 'Storing and indexing ordered collections.', 'data_structures', 2),
  ('strings', 'Strings', 'Working with text as a sequence of characters.', 'data_structures', 2),
  ('hash-maps', 'Hash Maps', 'Constant-time average lookup by key.', 'data_structures', 3),
  ('sets', 'Sets', 'Unordered collections that guarantee uniqueness.', 'data_structures', 2),
  ('stacks', 'Stacks', 'Last-in, first-out collections.', 'data_structures', 3),
  ('queues', 'Queues', 'First-in, first-out collections.', 'data_structures', 3),
  ('linked-lists', 'Linked Lists', 'Nodes linked by reference rather than index.', 'data_structures', 3),
  ('searching', 'Searching', 'Finding elements within a collection.', 'algorithms', 2),
  ('binary-search', 'Binary Search', 'Halving a sorted search space each step.', 'algorithms', 3),
  ('sorting', 'Sorting', 'Ordering elements by a comparison rule.', 'algorithms', 3),
  ('recursion', 'Recursion', 'Functions that solve a problem by calling themselves.', 'control_flow', 3),
  ('complexity-analysis', 'Complexity Analysis', 'Reasoning about time and space growth (Big O).', 'complexity', 2),
  ('debugging', 'Debugging', 'Locating and fixing incorrect behavior methodically.', 'debugging', 1);

insert into skill_dependencies (skill_id, prerequisite_skill_id)
select s.id, p.id from skills s, skills p where
  (s.slug, p.slug) in (
    ('data-types', 'variables'),
    ('operators', 'variables'),
    ('input-output', 'variables'),
    ('control-flow', 'variables'),
    ('functions', 'control-flow'),
    ('scope', 'functions'),
    ('arrays', 'variables'),
    ('strings', 'arrays'),
    ('hash-maps', 'arrays'),
    ('sets', 'hash-maps'),
    ('searching', 'arrays'),
    ('sorting', 'arrays'),
    ('binary-search', 'searching'),
    ('binary-search', 'sorting'),
    ('recursion', 'functions'),
    ('linked-lists', 'recursion'),
    ('stacks', 'arrays'),
    ('queues', 'arrays'),
    ('complexity-analysis', 'arrays'),
    ('debugging', 'control-flow')
  );

-- Concepts: one per skill, so lessons can reference a real concept_id
-- rather than leaving it null (Prompt 1 defined the concepts table but
-- never populated it).
insert into concepts (slug, name, skill_id)
select slug, name, id from skills;

-- ---------------------------------------------------------------------
-- Curriculum: Python Foundations — 7 modules
-- ---------------------------------------------------------------------
insert into curricula (slug, title, description, language_id, is_published, sort_order)
select 'python-foundations', 'Python Foundations', 'From your first variable to your first data structure and algorithm.', id, true, 1
from languages where slug = 'python';

insert into modules (curriculum_id, slug, title, description, sort_order, difficulty, estimated_minutes, learning_objectives)
select c.id, m.slug, m.title, m.description, m.sort_order, m.difficulty, m.estimated_minutes, m.learning_objectives
from curricula c
cross join (values
  ('getting-started', 'Foundations', 'Variables, data types, operators, and talking to your program.', 1, 1, 24,
    ARRAY['Store and name values', 'Recognize Python''s core data types', 'Combine values with operators', 'Read input and print output']),
  ('control-flow', 'Control Flow', 'Making decisions and repeating work.', 2, 1, 18,
    ARRAY['Branch logic with if/elif/else', 'Repeat work with for and while loops', 'Combine multiple conditions correctly']),
  ('functions', 'Functions', 'Packaging logic into reusable, named units.', 3, 2, 18,
    ARRAY['Define and call functions', 'Use parameters and return values', 'Understand variable scope']),
  ('arrays-and-strings', 'Arrays & Strings', 'Your first real data structures.', 4, 2, 14,
    ARRAY['Store and index a sequence', 'Treat text as an indexable sequence']),
  ('data-structures', 'Data Structures', 'Hash maps, sets, stacks, and queues.', 5, 3, 28,
    ARRAY['Look up values by key in constant average time', 'Guarantee uniqueness with a set', 'Model LIFO and FIFO ordering']),
  ('algorithms', 'Algorithms', 'Searching, sorting, recursion, and complexity.', 6, 3, 32,
    ARRAY['Search and sort a collection', 'Halve a sorted search space', 'Write a function that calls itself', 'Reason about Big O growth']),
  ('debugging-and-mistakes', 'Debugging', 'Reading errors and reasoning about broken code methodically.', 7, 1, 10,
    ARRAY['Read a traceback to find the failing line', 'Distinguish a crash from a wrong-answer bug'])
) as m(slug, title, description, sort_order, difficulty, estimated_minutes, learning_objectives)
where c.slug = 'python-foundations';

-- ---------------------------------------------------------------------
-- Lessons (22) — one-page: WHY / WHAT / HOW / EXAMPLE / COMMON MISTAKE / MICRO CHALLENGE
-- ---------------------------------------------------------------------
insert into lessons (
  module_id, concept_id, slug, title, why, what, how, example_code, example_language_id,
  common_mistake, micro_challenge_prompt, learning_objectives, key_takeaways, estimated_minutes, sort_order, is_published
)
select
  m.id, c.id, l.slug, l.title, l.why, l.what, l.how, l.example_code,
  (select id from languages where slug = 'python'),
  l.common_mistake, l.micro_challenge_prompt, l.learning_objectives, l.key_takeaways, l.estimated_minutes, l.sort_order, true
from modules m
join curricula cur on cur.id = m.curriculum_id and cur.slug = 'python-foundations'
join (values
  -- Module 1: getting-started
  ('getting-started', 'variables', 'naming-a-value', 'Naming a Value',
   'Programs need a way to remember a value so it can be used again later.',
   'A variable is a name bound to a value in memory.',
   'Choose a descriptive name, then assign a value with `=`.',
   'age = 27' || chr(10) || 'name = "Sam"' || chr(10) || 'print(name, "is", age, "years old")',
   'Reassigning a variable does not change its old value anywhere else it was used — it only changes what the name points to next.',
   'Create a variable `price` set to 12.5, then print it multiplied by 3.',
   ARRAY['Bind a value to a name with =', 'Explain what reassignment does'],
   ARRAY['A variable is a name, not a box that copies itself', 'Names should describe what they hold', 'Reassignment moves the name, not the old value'],
   5, 1),
  ('getting-started', 'data-types', 'kinds-of-values', 'Kinds of Values',
   'A program needs to treat text, numbers, and true/false differently — the type is what tells it how.',
   'Every value has a type: int, float, str, and bool are the four you will use constantly.',
   'Use `type(x)` to check a value''s type, and convert between types with `int()`, `float()`, `str()`.',
   'quantity = 3' || chr(10) || 'price = 4.5' || chr(10) || 'total = quantity * price' || chr(10) || 'print(type(total), total)',
   'Assuming `"3" + "4"` behaves like number addition — with strings, `+` concatenates, giving `"34"`, not `7`.',
   'Given a string `"42"`, convert it to an int and add 8 to it.',
   ARRAY['Identify a value''s type', 'Convert between str, int, and float'],
   ARRAY['int, float, str, and bool are the four core types', 'Operators behave differently per type', 'Convert explicitly rather than guessing'],
   5, 2),
  ('getting-started', 'operators', 'combining-values', 'Combining Values',
   'Almost every useful line of code combines two or more values into a new one.',
   'Arithmetic operators (+, -, *, /, %) combine numbers; comparison operators (==, <, >) produce booleans.',
   'Use `%` for remainder and `//` for whole-number division; use `==` (not `=`) to compare.',
   'total = 17' || chr(10) || 'print(total // 5, total % 5)' || chr(10) || 'print(total == 17)',
   'Using `=` (assignment) where `==` (comparison) was intended.',
   'Given a number of minutes, print how many whole hours and leftover minutes it contains.',
   ARRAY['Use arithmetic and comparison operators correctly', 'Distinguish = from =='],
   ARRAY['// gives whole-number division, % gives the remainder', '== compares, = assigns', 'Comparisons evaluate to a bool'],
   4, 3),
  ('getting-started', 'input-output', 'talking-to-the-program', 'Talking to the Program',
   'A program that cannot take input or show output cannot interact with anyone.',
   '`print()` writes text out; `input()` reads a line of text in, always as a string.',
   'Convert `input()`''s result with `int()` or `float()` before doing math on it.',
   'name = input("What is your name? ")' || chr(10) || 'print("Hello, " + name + "!")',
   'Forgetting that `input()` always returns a string, then trying to do math on it directly.',
   'Ask the user for their birth year and print their approximate age.',
   ARRAY['Read a line of input', 'Print formatted output'],
   ARRAY['input() always returns a string', 'print() can take multiple comma-separated arguments', 'Convert input before treating it as a number'],
   4, 4),
  -- Module 2: control-flow
  ('control-flow', 'control-flow', 'making-a-decision', 'Making a Decision',
   'Most real logic depends on a condition — programs need to branch.',
   'An `if` statement runs a block only when its condition is true.',
   'Write `if condition:`, indent the block, and optionally add `elif` / `else`.',
   'temperature = 30' || chr(10) || 'if temperature > 25:' || chr(10) || '    print("Hot")' || chr(10) || 'else:' || chr(10) || '    print("Not hot")',
   'Forgetting that `elif` is checked only if every condition above it was false — order matters.',
   'Write a check that prints "even" or "odd" for a variable `n`.',
   ARRAY['Branch with if/elif/else', 'Order conditions correctly'],
   ARRAY['Only the first true branch runs', 'elif is checked only if everything above it was false', 'Indentation defines the block in Python'],
   5, 1),
  ('control-flow', 'control-flow', 'repeating-work', 'Repeating Work',
   'Doing something N times, or until a condition changes, is a constant need.',
   'A `for` loop repeats over a sequence; a `while` loop repeats until a condition is false.',
   'Use `for x in range(n):` for a known count, `while condition:` for an unknown one.',
   'total = 0' || chr(10) || 'for i in range(5):' || chr(10) || '    total += i' || chr(10) || 'print(total)',
   'Writing a `while` loop whose condition never becomes false — an infinite loop.',
   'Sum the numbers from 1 to 10 using a loop.',
   ARRAY['Choose for vs while correctly', 'Avoid an infinite loop'],
   ARRAY['for loops fit a known count', 'while loops fit an unknown, condition-based count', 'Every while loop must change something the condition checks'],
   5, 2),
  ('control-flow', 'control-flow', 'nested-logic', 'Nested Logic',
   'Real decisions are often not a single condition — they depend on combinations of conditions.',
   'Conditions can nest inside loops and inside each other, and combine with `and` / `or` / `not`.',
   'Prefer combining conditions with `and`/`or` over deeply nesting `if` inside `if` when possible.',
   'for n in range(1, 6):' || chr(10) || '    if n % 2 == 0 and n > 2:' || chr(10) || '        print(n, "is even and > 2")',
   'Nesting conditions three or four levels deep instead of combining them with `and`/`or`, making the logic hard to follow.',
   'Print every number from 1 to 20 that is divisible by 3 or 5, but not both.',
   ARRAY['Combine conditions with and/or/not', 'Nest a condition inside a loop correctly'],
   ARRAY['and/or/not combine boolean expressions', 'Deep nesting is a readability smell', 'Order still matters inside nested blocks'],
   4, 3),
  -- Module 3: functions
  ('functions', 'functions', 'packaging-logic', 'Packaging Logic',
   'Copy-pasting the same three lines everywhere makes a program hard to change safely.',
   'A function is a named, reusable block of logic you call by name instead of repeating.',
   'Define with `def name():`, then call it with `name()`.',
   'def greet():' || chr(10) || '    print("Welcome to CodeForge")' || chr(10) || chr(10) || 'greet()' || chr(10) || 'greet()',
   'Defining a function but forgetting to actually call it — nothing happens silently.',
   'Write a function `shout(word)` that prints the word in uppercase followed by "!".',
   ARRAY['Define a function with def', 'Call a function by name'],
   ARRAY['A function only runs when called', 'Naming a function well documents intent', 'Repetition is a signal to extract a function'],
   4, 1),
  ('functions', 'functions', 'parameters-and-returns', 'Parameters and Return Values',
   'A function that cannot take input or hand back a result can only do one fixed thing.',
   'Parameters let a function accept input; `return` lets it hand a value back to the caller.',
   'List parameters in the `def` line; use `return value` to exit and produce a result.',
   'def add_tax(price, rate):' || chr(10) || '    return price + (price * rate)' || chr(10) || chr(10) || 'print(add_tax(100, 0.08))',
   'Using `print()` inside a function instead of `return`, so the result cannot be used by the caller.',
   'Write a function `average(a, b)` that returns the average of two numbers.',
   ARRAY['Accept input via parameters', 'Return a usable value'],
   ARRAY['return hands a value back; print only displays it', 'A function without return implicitly returns None', 'Parameters are local to the function'],
   5, 2),
  ('functions', 'scope', 'variable-scope', 'Variable Scope',
   'If every variable were visible everywhere, large programs would become impossible to reason about.',
   'Scope is where a name is visible: variables created inside a function do not exist outside it.',
   'Pass values in as parameters and out as return values, instead of reaching for outer variables.',
   'def double(x):' || chr(10) || '    result = x * 2' || chr(10) || '    return result' || chr(10) || chr(10) || 'print(double(5))' || chr(10) || '# result is not visible here',
   'Expecting a variable defined inside a function to still exist after the function returns.',
   'Predict what happens if you try to print `result` outside the `double` function above.',
   ARRAY['Explain what local scope means', 'Predict a scope-related error'],
   ARRAY['A variable created inside a function is local to it', 'Local variables disappear when the function returns', 'Pass data in and out explicitly instead of relying on outer scope'],
   4, 3),
  -- Module 4: arrays-and-strings
  ('arrays-and-strings', 'arrays', 'storing-a-sequence', 'Storing a Sequence',
   'Single variables cannot hold a growing collection of related values.',
   'A list (array) stores an ordered, indexable sequence of values.',
   'Create with `[]`, access by index, and use `.append()` to grow it.',
   'scores = [88, 92, 79]' || chr(10) || 'scores.append(95)' || chr(10) || 'print(scores[0], len(scores))',
   'Assuming index 1 is the "first" element — indexing starts at 0.',
   'Given a list of numbers, return the largest one without using `max()`.',
   ARRAY['Index into a list', 'Grow a list with append'],
   ARRAY['Indexing starts at 0', 'append() adds to the end in place', 'len() gives the current size'],
   5, 1),
  ('arrays-and-strings', 'strings', 'text-as-a-sequence', 'Text as a Sequence',
   'Almost every program eventually reads or transforms text.',
   'A string is an immutable sequence of characters, sliceable like a list.',
   'Index with `s[i]`, slice with `s[a:b]`, and use string methods like `.lower()`.',
   'word = "Forge"' || chr(10) || 'print(word[0], word[-1], word.lower())',
   'Trying to modify a string in place — strings are immutable, so methods return a new string.',
   'Write a function that returns true if a word reads the same forwards and backwards.',
   ARRAY['Index and slice a string', 'Explain why strings are immutable'],
   ARRAY['Strings are indexable but immutable', 'Negative indices count from the end', 'String methods return a new string rather than mutating'],
   5, 2),
  -- Module 5: data-structures
  ('data-structures', 'hash-maps', 'key-value-lookup', 'Key-Value Lookup',
   'Searching a list for a match gets slower as it grows — sometimes you need lookup that does not.',
   'A dict (hash map) stores key-value pairs with average constant-time lookup by key.',
   'Create with `{}`, read/write with `d[key]`, and check membership with `in`.',
   'ages = {"Sam": 27, "Lee": 31}' || chr(10) || 'ages["Kai"] = 22' || chr(10) || 'print("Sam" in ages, ages["Lee"])',
   'Accessing a missing key with `d[key]` instead of `d.get(key)`, which crashes instead of returning None.',
   'Given a list of words, build a dict counting how many times each word appears.',
   ARRAY['Read and write dict entries', 'Explain average-case lookup speed'],
   ARRAY['Dict lookup is average O(1), list search is O(n)', 'in checks key membership, not value membership', 'get() avoids a crash on a missing key'],
   6, 1),
  ('data-structures', 'sets', 'unique-collections', 'Unique Collections',
   'Sometimes order does not matter and duplicates should be impossible by construction.',
   'A set stores unique, unordered values with the same fast average lookup as a dict.',
   'Create with `set()` or `{}` with values, add with `.add()`, combine with `|` and `&`.',
   'a = {1, 2, 3}' || chr(10) || 'b = {2, 3, 4}' || chr(10) || 'print(a & b, a | b)',
   'Expecting a set to preserve insertion order the way a list does.',
   'Given two lists of usernames, find the ones that appear in both.',
   ARRAY['Use a set to guarantee uniqueness', 'Combine sets with union and intersection'],
   ARRAY['Sets guarantee uniqueness automatically', 'Order is not guaranteed', '& is intersection, | is union'],
   5, 2),
  ('data-structures', 'stacks', 'last-in-first-out', 'Last-In, First-Out', 'Some problems (undo history, matching brackets) need to reverse the order things happened in.',
   'A stack processes the most recently added item first — last in, first out.',
   'A Python list works as a stack: `.append()` to push, `.pop()` to pop the last item.',
   'stack = []' || chr(10) || 'stack.append("a")' || chr(10) || 'stack.append("b")' || chr(10) || 'print(stack.pop())',
   'Popping from the front of a list (`pop(0)`) instead of the end — that is O(n), not the O(1) a stack promises.',
   'Use a stack to reverse the order of a list of three items.',
   ARRAY['Implement push/pop with a list', 'Explain LIFO ordering'],
   ARRAY['Stacks are last-in, first-out', 'append/pop at the end are O(1)', 'pop(0) at the front is not a real stack operation'],
   5, 3),
  ('data-structures', 'queues', 'first-in-first-out', 'First-In, First-Out',
   'Some problems (task scheduling, print jobs) need to process things in the order they arrived.',
   'A queue processes the oldest added item first — first in, first out.',
   'Use `collections.deque` for an efficient queue: `.append()` to enqueue, `.popleft()` to dequeue.',
   'from collections import deque' || chr(10) || 'q = deque()' || chr(10) || 'q.append("first")' || chr(10) || 'q.append("second")' || chr(10) || 'print(q.popleft())',
   'Using a plain list with `.pop(0)` for a queue — it works, but it is O(n) instead of deque''s O(1).',
   'Simulate three people joining a line and being served in order.',
   ARRAY['Implement enqueue/dequeue with deque', 'Explain FIFO ordering'],
   ARRAY['Queues are first-in, first-out', 'deque gives O(1) operations at both ends', 'A plain list is a poor queue at scale'],
   5, 4),
  -- Module 6: algorithms
  ('algorithms', 'searching', 'finding-things', 'Finding Things',
   'Before optimizing a search, you need the straightforward version that always works.',
   'Linear search checks each element in order until it finds a match or runs out.',
   'Loop through the collection, compare each element, and return as soon as you find a match.',
   'def find(nums, target):' || chr(10) || '    for i, n in enumerate(nums):' || chr(10) || '        if n == target:' || chr(10) || '            return i' || chr(10) || '    return -1',
   'Forgetting to handle the "not found" case, so the function crashes or returns nothing meaningful.',
   'Given a list and a target, return whether the target exists.',
   ARRAY['Implement linear search', 'Handle the not-found case explicitly'],
   ARRAY['Linear search is O(n) — no assumptions about order needed', 'Always define what "not found" returns', 'It is the correct baseline before optimizing'],
   5, 1),
  ('algorithms', 'sorting', 'putting-things-in-order', 'Putting Things in Order',
   'Many algorithms (including binary search) only work correctly on sorted data.',
   'Sorting rearranges a collection according to a comparison rule, ascending by default.',
   'Use `sorted(list)` for a new sorted copy, or `.sort()` to sort in place.',
   'scores = [42, 17, 89, 3]' || chr(10) || 'print(sorted(scores))' || chr(10) || 'scores.sort(reverse=True)' || chr(10) || 'print(scores)',
   'Confusing `sorted()` (returns a new list) with `.sort()` (mutates in place and returns None).',
   'Sort a list of names alphabetically and print the first and last.',
   ARRAY['Sort a collection ascending and descending', 'Distinguish sorted() from .sort()'],
   ARRAY['sorted() returns a new list; .sort() mutates and returns None', 'reverse=True sorts descending', 'Sorting is a prerequisite for binary search'],
   4, 2),
  ('algorithms', 'binary-search', 'divide-and-conquer-search', 'Divide and Conquer Search',
   'Linear search gets slow on large sorted collections — halving the search space each step is far faster.',
   'Binary search repeatedly checks the middle of a sorted range and discards the half that cannot contain the target.',
   'Track `low`/`high` bounds, check the midpoint, and move a bound based on the comparison.',
   'def binary_search(nums, target):' || chr(10) || '    low, high = 0, len(nums) - 1' || chr(10) || '    while low <= high:' || chr(10) || '        mid = (low + high) // 2' || chr(10) || '        if nums[mid] == target:' || chr(10) || '            return mid' || chr(10) || '        if nums[mid] < target:' || chr(10) || '            low = mid + 1' || chr(10) || '        else:' || chr(10) || '            high = mid - 1' || chr(10) || '    return -1',
   'Running binary search on unsorted data — the halving logic silently gives wrong answers instead of erroring.',
   'Trace binary search for target 7 on [1, 3, 5, 7, 9, 11] by hand: which indices get checked?',
   ARRAY['Implement binary search with low/high bounds', 'Explain why the input must be sorted'],
   ARRAY['Binary search requires sorted input', 'Each step halves the remaining search space', 'It runs in O(log n) instead of O(n)'],
   6, 3),
  ('algorithms', 'recursion', 'functions-that-call-themselves', 'Functions That Call Themselves',
   'Some problems (tree traversal, nested structures) are naturally defined in terms of smaller versions of themselves.',
   'A recursive function calls itself on a smaller input until it reaches a base case that stops the recursion.',
   'Always write the base case first, then the recursive case that moves toward it.',
   'def countdown(n):' || chr(10) || '    if n <= 0:' || chr(10) || '        print("Liftoff!")' || chr(10) || '        return' || chr(10) || '    print(n)' || chr(10) || '    countdown(n - 1)',
   'Forgetting the base case entirely, causing infinite recursion until Python raises a RecursionError.',
   'Write a recursive function that returns the sum of numbers from 1 to n.',
   ARRAY['Identify a base case and recursive case', 'Trace a simple recursive call'],
   ARRAY['Every recursive function needs a base case', 'Each call should move measurably closer to the base case', 'Recursion trades explicit loops for the call stack'],
   6, 4),
  ('algorithms', 'complexity-analysis', 'measuring-growth', 'Measuring Growth',
   'Two solutions that both "work" can behave completely differently as input size grows.',
   'Big O describes how runtime or memory grows relative to input size, ignoring constant factors.',
   'Count how the number of operations scales as n grows: constant, linear, and quadratic are the common ones early on.',
   '# O(n): one pass' || chr(10) || 'for x in items:' || chr(10) || '    process(x)' || chr(10) || chr(10) || '# O(n^2): nested pass' || chr(10) || 'for x in items:' || chr(10) || '    for y in items:' || chr(10) || '        compare(x, y)',
   'Judging speed by lines of code instead of by how the operation count scales with input size.',
   'Given a nested loop over a list of length n, what is its time complexity?',
   ARRAY['Identify O(1), O(n), and O(n^2) code', 'Explain why constants are ignored in Big O'],
   ARRAY['Big O describes growth, not exact speed', 'A nested loop over the same input is typically O(n^2)', 'Big O ignores constant factors and lower-order terms'],
   5, 5),
  -- Module 7: debugging-and-mistakes
  ('debugging-and-mistakes', 'debugging', 'reading-error-messages', 'Reading Error Messages',
   'A traceback looks intimidating, but it is the fastest path to fixing a crash — most beginners skip past it.',
   'A traceback shows the call chain that led to the error and, at the bottom, the actual exception and message.',
   'Read the last line first for the error type and message, then look at the line number it points to.',
   '# Given this error:' || chr(10) || '# IndexError: list index out of range' || chr(10) || '#   at line 3: print(scores[5])' || chr(10) || '# scores only has 3 elements (indices 0-2)',
   'Reading a traceback top-to-bottom and stopping at the first unfamiliar line instead of checking the bottom first.',
   'Given the error above, what is the smallest fix?',
   ARRAY['Locate the failing line from a traceback', 'Distinguish a crash from a silent wrong-answer bug'],
   ARRAY['Read the last line of a traceback first', 'The error type tells you the category of bug', 'Not every bug crashes — some just produce a wrong answer'],
   5, 1)
) as l(module_slug, skill_slug, slug, title, why, what, how, example_code, common_mistake, micro_challenge_prompt, learning_objectives, key_takeaways, estimated_minutes, sort_order)
  on m.slug = l.module_slug
join concepts c on c.slug = l.skill_slug;

-- ---------------------------------------------------------------------
-- Lesson code examples — same concept, different language syntax (see
-- LANGUAGE STRATEGY). Covers a representative subset, not every lesson.
-- ---------------------------------------------------------------------
insert into lesson_code_examples (lesson_id, language_id, code, explanation, sort_order)
select l.id, lang.id, e.code, e.explanation, 2
from lessons l
join (values
  ('naming-a-value', 'javascript',
   'let age = 27;' || chr(10) || 'const name = "Sam";' || chr(10) || 'console.log(name, "is", age, "years old");',
   'let for a reassignable name, const for one that will not be reassigned.'),
  ('making-a-decision', 'javascript',
   'const temperature = 30;' || chr(10) || 'if (temperature > 25) {' || chr(10) || '  console.log("Hot");' || chr(10) || '} else {' || chr(10) || '  console.log("Not hot");' || chr(10) || '}',
   'Same branching concept — curly braces define the block instead of indentation.'),
  ('repeating-work', 'javascript',
   'let total = 0;' || chr(10) || 'for (let i = 0; i < 5; i++) {' || chr(10) || '  total += i;' || chr(10) || '}' || chr(10) || 'console.log(total);',
   'A C-style for loop: initializer, condition, and increment in one line.'),
  ('packaging-logic', 'javascript',
   'function greet() {' || chr(10) || '  console.log("Welcome to CodeForge");' || chr(10) || '}' || chr(10) || chr(10) || 'greet();' || chr(10) || 'greet();',
   'function declarations work the same way — define once, call by name.'),
  ('storing-a-sequence', 'javascript',
   'const scores = [88, 92, 79];' || chr(10) || 'scores.push(95);' || chr(10) || 'console.log(scores[0], scores.length);',
   'Arrays are zero-indexed in JavaScript too; push() is the equivalent of append().'),
  ('key-value-lookup', 'javascript',
   'const ages = new Map([["Sam", 27], ["Lee", 31]]);' || chr(10) || 'ages.set("Kai", 22);' || chr(10) || 'console.log(ages.has("Sam"), ages.get("Lee"));',
   'Map gives the same average O(1) key lookup as a Python dict.'),
  ('finding-things', 'javascript',
   'function find(nums, target) {' || chr(10) || '  for (let i = 0; i < nums.length; i++) {' || chr(10) || '    if (nums[i] === target) return i;' || chr(10) || '  }' || chr(10) || '  return -1;' || chr(10) || '}',
   'Same linear scan — note === for strict equality instead of ==.'),
  ('functions-that-call-themselves', 'javascript',
   'function countdown(n) {' || chr(10) || '  if (n <= 0) {' || chr(10) || '    console.log("Liftoff!");' || chr(10) || '    return;' || chr(10) || '  }' || chr(10) || '  console.log(n);' || chr(10) || '  countdown(n - 1);' || chr(10) || '}',
   'Identical structure: base case first, then the recursive call.')
) as e(lesson_slug, language_slug, code, explanation) on l.slug = e.lesson_slug
join languages lang on lang.slug = e.language_slug;

-- ---------------------------------------------------------------------
-- Micro-checks — lightweight understanding checks before a problem
-- ---------------------------------------------------------------------
insert into micro_checks (lesson_id, type, question, code_snippet, options, correct_answer, explanation, sort_order)
select l.id, mc.type::micro_check_type, mc.question, mc.code_snippet, mc.options::jsonb, mc.correct_answer, mc.explanation, mc.sort_order
from lessons l
join (values
  ('naming-a-value', 'multiple_choice', 'What is the value of x after this runs?', 'x = 5' || chr(10) || 'x = x + 2',
   '[{"id":"a","label":"5"},{"id":"b","label":"7"},{"id":"c","label":"2"},{"id":"d","label":"Error"}]', 'b',
   'x starts at 5; x + 2 evaluates to 7, and that new value is bound back to x.', 1),
  ('kinds-of-values', 'predict_output', 'What does this print?', 'print("3" + "4")', null, '34',
   'With two strings, + concatenates rather than adding numerically — the result is the text "34".', 1),
  ('combining-values', 'predict_output', 'What does this print?', 'print(17 // 5, 17 % 5)', null, '3 2',
   '17 // 5 is whole-number division (3); 17 % 5 is the remainder (2).', 1),
  ('making-a-decision', 'multiple_choice', 'Which branch runs for x = 10?', 'if x > 20:' || chr(10) || '    print("big")' || chr(10) || 'elif x > 5:' || chr(10) || '    print("medium")' || chr(10) || 'else:' || chr(10) || '    print("small")',
   '[{"id":"a","label":"big"},{"id":"b","label":"medium"},{"id":"c","label":"small"},{"id":"d","label":"Nothing prints"}]', 'b',
   'x > 20 is false, x > 5 is true, so "medium" prints and the else is skipped.', 1),
  ('repeating-work', 'conceptual', 'Why must a while loop''s condition eventually become false?', null, null, 'self-assessed',
   'If nothing inside the loop changes a value the condition depends on, the loop runs forever — an infinite loop.', 1),
  ('packaging-logic', 'conceptual', 'What happens if a function is defined but never called?', null, null, 'self-assessed',
   'Nothing — the code inside a function only runs when the function is actually called, no matter how it is defined.', 1),
  ('parameters-and-returns', 'predict_output', 'What does this print?', 'def add(a, b):' || chr(10) || '    a + b' || chr(10) || chr(10) || 'print(add(2, 3))', null, 'None',
   'The function never uses return, so it implicitly returns None — the sum is computed but never handed back.', 1),
  ('storing-a-sequence', 'multiple_choice', 'What is scores[0] after this?', 'scores = [88, 92, 79]' || chr(10) || 'scores.append(95)',
   '[{"id":"a","label":"95"},{"id":"b","label":"88"},{"id":"c","label":"79"},{"id":"d","label":"IndexError"}]', 'b',
   'append() adds to the end; index 0 is still the first element, 88.', 1),
  ('key-value-lookup', 'conceptual', 'Why is dict lookup typically faster than searching a list?', null, null, 'self-assessed',
   'A dict computes where a key lives via hashing, giving average O(1) lookup, while a list must scan entries one by one — O(n).', 1),
  ('divide-and-conquer-search', 'conceptual', 'Why does binary search require sorted input?', null, null, 'self-assessed',
   'Binary search decides which half to discard by comparing the midpoint to the target — that comparison is only meaningful if the data is ordered.', 1),
  ('functions-that-call-themselves', 'predict_output', 'What is the base case in this function?', 'def countdown(n):' || chr(10) || '    if n <= 0:' || chr(10) || '        return' || chr(10) || '    countdown(n - 1)', null, 'n <= 0',
   'The base case is the condition that stops further recursive calls — here, n <= 0.', 1)
) as mc(lesson_slug, type, question, code_snippet, options, correct_answer, explanation, sort_order)
  on l.slug = mc.lesson_slug;

-- ---------------------------------------------------------------------
-- Problems (42) — original content, distributed beginner/easy/medium,
-- across implementation, debugging, and output-prediction types. See
-- PROBLEM PROGRESSION for the progression_level rationale.
-- ---------------------------------------------------------------------
insert into problems (
  slug, title, statement, difficulty, problem_type, progression_level,
  learning_objective, constraints, expected_time_complexity, expected_space_complexity, is_published
)
values
  ('greeting-printer', 'Print a Personal Greeting',
   'Write a function `greet(name)` that returns the string "Hello, <name>! Welcome to CodeForge." for any given name.',
   'intro', 'implementation', 1,
   'Practice combining a function parameter into a formatted string.',
   'name is a non-empty string.', null, null, true),
  ('temperature-converter', 'Convert Celsius to Fahrenheit',
   'Write a function `to_fahrenheit(celsius)` that converts a Celsius temperature to Fahrenheit using F = C * 9/5 + 32, rounded to one decimal place.',
   'easy', 'implementation', 2,
   'Practice applying an arithmetic formula with correct operator precedence.',
   'celsius is a float or int.', null, null, true),
  ('total-price-calculator', 'Calculate Total With Tax',
   'Write a function `total_with_tax(price, tax_rate)` that returns the final price after adding tax, rounded to two decimal places.',
   'easy', 'implementation', 2,
   'Practice combining multiplication and addition to solve a real calculation.',
   'price >= 0 and 0 <= tax_rate <= 1.', null, null, true),
  ('type-predictor', 'Predict the Data Type',
   'Given the expression `type(3 + 4.0)`, what does it print? Given `type("3" + "4")`, what does it print? Answer with both type names separated by a space, e.g. "int str".',
   'intro', 'output_prediction', 1,
   'Practice reasoning about how operators behave differently across types.',
   null, null, null, true),
  ('even-odd-classifier', 'Classify Even or Odd',
   'Write a function `classify(n)` that returns "even" if n is even and "odd" if n is odd.',
   'intro', 'implementation', 1,
   'Practice a single conditional using the modulo operator.',
   'n is an integer and may be negative.', null, null, true),
  ('grade-classifier', 'Assign a Letter Grade',
   'Write a function `letter_grade(score)` that returns "A" for 90 or above, "B" for 80-89, "C" for 70-79, and "F" below 70.',
   'easy', 'implementation', 2,
   'Practice ordering elif branches correctly for range-based logic.',
   '0 <= score <= 100.', null, null, true),
  ('leap-year-checker', 'Check for a Leap Year',
   'Write a function `is_leap_year(year)` that returns True if the year is a leap year: divisible by 4, except century years, unless also divisible by 400.',
   'easy', 'implementation', 3,
   'Practice combining multiple conditions with and/or correctly.',
   'year is a positive integer.', null, null, true),
  ('fizz-buzz-variant', 'Fizz Buzz Variant',
   'Print numbers from 1 to n. For multiples of 3, print "Forge" instead of the number. For multiples of 5, print "Code". For multiples of both, print "ForgeCode".',
   'intro', 'implementation', 2,
   'Practice combining multiple conditions correctly.',
   '1 <= n <= 1000.', null, null, true),
  ('price-formatter', 'Format a Price as Currency',
   'Write a function `format_price(amount)` that returns the amount as a string formatted like "$12.50", always with two decimal places.',
   'intro', 'implementation', 1,
   'Practice using a function to encapsulate string formatting logic.',
   'amount >= 0.', null, null, true),
  ('running-total-tracker', 'Track a Running Total',
   'Write a function `running_totals(amounts)` that returns a list where each entry is the sum of all amounts up to and including that position.',
   'easy', 'implementation', 2,
   'Practice maintaining state across a loop inside a function.',
   'amounts is a non-empty list of numbers.', 'O(n)', 'O(n)', true),
  ('default-parameter-predictor', 'Predict Default Parameter Behavior',
   'Given `def greet(name="friend"): return "Hi " + name`, what does `greet()` return? What does `greet("Sam")` return? Answer with both results separated by a comma.',
   'easy', 'output_prediction', 2,
   'Practice reasoning about default parameter values.',
   null, null, null, true),
  ('largest-value', 'Largest Value',
   'Given a non-empty list of integers, return the largest value without using a built-in max function.',
   'intro', 'implementation', 1,
   'Practice a single linear scan with a running best value.',
   'nums has at least one element.', 'O(n)', 'O(1)', true),
  ('seat-accessor', 'Access the Requested Seat',
   'Given a list of seat labels and a zero-based seat number, return the label at that seat, or None if the seat number is out of range.',
   'intro', 'implementation', 1,
   'Practice safe index access instead of assuming the index always exists.',
   'seats is a list of strings; seat_number is an integer.', 'O(1)', 'O(1)', true),
  ('occurrence-counter', 'Count How Many Times a Value Appears',
   'Given a list and a target value, return how many times the target appears in the list, without using .count().',
   'easy', 'implementation', 2,
   'Practice a linear scan that accumulates a count.',
   null, 'O(n)', 'O(1)', true),
  ('array-reverser', 'Reverse an Array In Place',
   'Write a function that reverses a list in place — without creating a new list and without using .reverse() or slicing.',
   'easy', 'implementation', 3,
   'Practice the two-pointer swap technique.',
   null, 'O(n)', 'O(1)', true),
  ('duplicate-remover', 'Duplicate Remover',
   'Given a list of integers, return a new list with duplicates removed, preserving the first occurrence order.',
   'easy', 'implementation', 3,
   'Practice using a hash set to track seen values.',
   null, 'O(n)', 'O(n)', true),
  ('inventory-total', 'Total an Inventory List',
   'Given a list of items, each with a "price" and "quantity", return the total value of the inventory: the sum of price times quantity for every item.',
   'medium', 'implementation', 5,
   'Practice applying arrays and arithmetic together to solve a realistic scenario.',
   'Each item is a dict with keys "price" and "quantity".', 'O(n)', 'O(1)', true),
  ('vowel-counter', 'Vowel Counter',
   'Write a function that counts how many vowels (a, e, i, o, u — case-insensitive) appear in a string.',
   'intro', 'implementation', 1,
   'Practice iterating over a string and conditional counting.',
   null, 'O(n)', 'O(1)', true),
  ('palindrome-check', 'Palindrome Check',
   'Write a function that returns whether a given string reads the same forwards and backwards, ignoring case.',
   'intro', 'implementation', 2,
   'Practice two-pointer comparison over a string.',
   null, 'O(n)', 'O(1)', true),
  ('word-reverser', 'Reverse Each Word in a Sentence',
   'Given a sentence, return a new sentence where each word is individually reversed but word order stays the same — for example "hi there" becomes "ih ereht".',
   'easy', 'implementation', 3,
   'Practice combining string splitting, slicing, and joining.',
   null, 'O(n)', 'O(n)', true),
  ('character-frequency', 'Find the Most Frequent Character',
   'Given a non-empty string, return the character that appears most often. If there is a tie, return the one that appears first in the string.',
   'medium', 'implementation', 4,
   'Practice using a hash map to count frequencies, then scanning for the maximum.',
   null, 'O(n)', 'O(n)', true),
  ('pair-sum-finder', 'Pair Sum Finder',
   'Given a list of integers `nums` and a target integer `target`, return the indices of the two numbers that add up to `target`. Assume exactly one valid pair exists, and you cannot use the same element twice.',
   'easy', 'implementation', 3,
   'Understand average constant-time lookup with a hash map.',
   null, 'O(n)', 'O(n)', true),
  ('anagram-pair-check', 'Anagram Pair Check',
   'Given two strings, return whether they are anagrams of each other — containing exactly the same letters, ignoring order and case.',
   'easy', 'implementation', 3,
   'Practice frequency counting with a hash map.',
   null, 'O(n)', 'O(n)', true),
  ('first-unique-character', 'Find the First Non-Repeating Character',
   'Given a string, return the index of the first character that does not repeat anywhere else in the string, or -1 if every character repeats.',
   'medium', 'implementation', 4,
   'Practice a two-pass hash map technique: count first, then scan.',
   null, 'O(n)', 'O(n)', true),
  ('unique-visitor-counter', 'Count Unique Visitors',
   'Given a list of visitor names with possible repeats, return the number of distinct visitors.',
   'intro', 'implementation', 2,
   'Practice using a set to count unique values.',
   null, 'O(n)', 'O(n)', true),
  ('common-elements-finder', 'Find Elements in Both Lists',
   'Given two lists, return a list of the values that appear in both, with no duplicates, in any order.',
   'easy', 'implementation', 3,
   'Practice using set intersection to solve a two-collection problem.',
   null, 'O(n + m)', 'O(n)', true),
  ('stack-balance-checker', 'Balanced Brackets',
   'Given a string containing only the characters ( ) [ ] { }, determine whether every bracket is properly closed and nested.',
   'medium', 'implementation', 4,
   'Practice using a stack to track open brackets.',
   null, 'O(n)', 'O(n)', true),
  ('undo-stack-simulator', 'Simulate an Undo Stack',
   'Given a list of actions where the literal "undo" removes the most recently added action instead of being added itself, return the final list of actions still in effect.',
   'easy', 'implementation', 2,
   'Practice using a stack — push on action, pop on undo — to model history.',
   'actions is a list of strings, each either an action name or "undo".', 'O(n)', 'O(n)', true),
  ('ticket-queue-simulator', 'Simulate a Ticket Queue',
   'Given a list of people joining a queue and a number of people to serve, return the names of the people served, in the order they joined.',
   'easy', 'implementation', 2,
   'Practice using a queue (FIFO) to model real-world ordering.',
   null, 'O(n)', 'O(n)', true),
  ('print-queue-order', 'Predict Print Queue Order',
   'Given a deque where "a", "b", "c" are appended in order and then popleft() is called twice, what values remain in the queue? Answer as a list, e.g. ["c"].',
   'easy', 'output_prediction', 2,
   'Practice tracing FIFO operations by hand.',
   null, null, null, true),
  ('linked-list-reverser', 'Reverse a Linked List',
   'Given the head of a singly linked list, reverse it in place and return the new head.',
   'medium', 'implementation', 4,
   'Practice pointer manipulation without losing reference to the rest of the list.',
   null, 'O(n)', 'O(1)', true),
  ('middle-node-finder', 'Find the Middle Node',
   'Given the head of a singly linked list, return the value of the middle node. If there are two middle nodes, return the second one.',
   'medium', 'implementation', 3,
   'Practice the two-pointer (slow/fast) technique on a linked list.',
   null, 'O(n)', 'O(1)', true),
  ('missing-number-finder', 'Missing Number Finder',
   'Given a list containing n distinct numbers from 0 to n, return the one number missing from the list.',
   'easy', 'implementation', 3,
   'Practice using arithmetic sum as an alternative to a hash set.',
   null, 'O(n)', 'O(1)', true),
  ('linear-search-implementer', 'Implement Linear Search',
   'Write a function `linear_search(nums, target)` that returns the index of target in nums, or -1 if it is not present, by checking each element in order.',
   'intro', 'implementation', 1,
   'Practice the baseline search algorithm before optimizing.',
   null, 'O(n)', 'O(1)', true),
  ('score-sorter', 'Sort Scores Ascending',
   'Given a list of numeric scores, return a new list sorted from lowest to highest without using the built-in sorted() or .sort().',
   'easy', 'implementation', 2,
   'Practice implementing a simple sort (e.g. selection sort) by hand.',
   null, 'O(n^2)', 'O(n)', true),
  ('bubble-sort-tracer', 'Trace a Bubble Sort Pass',
   'Given [5, 2, 4, 1] and a single left-to-right bubble sort pass (swap adjacent out-of-order pairs), what is the list after one pass? Answer as a list.',
   'easy', 'output_prediction', 2,
   'Practice tracing a sorting algorithm step by step.',
   null, null, null, true),
  ('binary-search-implementer', 'Implement Binary Search',
   'Write a function `binary_search(nums, target)` that returns the index of target in a sorted list nums, or -1 if not present, using O(log n) comparisons.',
   'medium', 'implementation', 3,
   'Practice the low/high/mid binary search pattern.',
   'nums is sorted ascending.', 'O(log n)', 'O(1)', true),
  ('insert-position-finder', 'Find the Correct Insert Position',
   'Given a sorted list and a target value not in the list, return the index where the target should be inserted to keep the list sorted.',
   'medium', 'implementation', 4,
   'Practice adapting binary search to find a boundary instead of an exact match.',
   'nums is sorted ascending with no duplicates.', 'O(log n)', 'O(1)', true),
  ('factorial-recursive', 'Compute Factorial Recursively',
   'Write a recursive function `factorial(n)` that returns n! (n * (n-1) * ... * 1), with factorial(0) equal to 1.',
   'easy', 'implementation', 2,
   'Practice identifying a base case and a recursive case.',
   '0 <= n <= 20.', 'O(n)', 'O(n)', true),
  ('digit-sum-recursive', 'Sum the Digits Recursively',
   'Write a recursive function `digit_sum(n)` that returns the sum of the digits of a non-negative integer n.',
   'easy', 'implementation', 3,
   'Practice recursion on a problem that is not naturally a list.',
   'n >= 0.', 'O(d)', 'O(d)', true),
  ('off-by-one-fixer', 'Fix the Off-By-One Bug',
   'This function is supposed to return the sum of all elements in a list but crashes with an IndexError. Find and fix the bug.' || chr(10) || chr(10) ||
   'def sum_list(nums):' || chr(10) || '    total = 0' || chr(10) || '    for i in range(1, len(nums)):' || chr(10) || '        total += nums[i]' || chr(10) || '    return total',
   'easy', 'debugging', 2,
   'Practice recognizing an off-by-one range boundary.',
   null, null, null, true),
  ('infinite-loop-fixer', 'Fix the Infinite Loop',
   'This function never returns for any positive n. Find and fix the bug.' || chr(10) || chr(10) ||
   'def countdown(n):' || chr(10) || '    while n > 0:' || chr(10) || '        print(n)' || chr(10) || '    return "done"',
   'easy', 'debugging', 2,
   'Practice recognizing a missing state update in a while loop condition.',
   null, null, null, true);

-- ---------------------------------------------------------------------
-- Problem <-> skill links (teaches)
-- ---------------------------------------------------------------------
insert into problem_skills (problem_id, skill_id, relationship)
select p.id, s.id, 'teaches'
from problems p
join (values
  ('greeting-printer', 'functions'),
  ('temperature-converter', 'operators'),
  ('total-price-calculator', 'operators'),
  ('type-predictor', 'data-types'),
  ('even-odd-classifier', 'control-flow'),
  ('grade-classifier', 'control-flow'),
  ('leap-year-checker', 'control-flow'),
  ('fizz-buzz-variant', 'control-flow'),
  ('price-formatter', 'functions'),
  ('running-total-tracker', 'functions'),
  ('default-parameter-predictor', 'scope'),
  ('largest-value', 'arrays'),
  ('seat-accessor', 'arrays'),
  ('occurrence-counter', 'arrays'),
  ('array-reverser', 'arrays'),
  ('duplicate-remover', 'arrays'),
  ('inventory-total', 'arrays'),
  ('vowel-counter', 'strings'),
  ('palindrome-check', 'strings'),
  ('word-reverser', 'strings'),
  ('character-frequency', 'strings'),
  ('pair-sum-finder', 'hash-maps'),
  ('anagram-pair-check', 'hash-maps'),
  ('first-unique-character', 'hash-maps'),
  ('unique-visitor-counter', 'sets'),
  ('common-elements-finder', 'sets'),
  ('stack-balance-checker', 'stacks'),
  ('undo-stack-simulator', 'stacks'),
  ('ticket-queue-simulator', 'queues'),
  ('print-queue-order', 'queues'),
  ('linked-list-reverser', 'linked-lists'),
  ('middle-node-finder', 'linked-lists'),
  ('missing-number-finder', 'searching'),
  ('linear-search-implementer', 'searching'),
  ('score-sorter', 'sorting'),
  ('bubble-sort-tracer', 'sorting'),
  ('binary-search-implementer', 'binary-search'),
  ('insert-position-finder', 'binary-search'),
  ('factorial-recursive', 'recursion'),
  ('digit-sum-recursive', 'recursion'),
  ('off-by-one-fixer', 'debugging'),
  ('infinite-loop-fixer', 'debugging')
) as ps(problem_slug, skill_slug) on ps.problem_slug = p.slug
join skills s on s.slug = ps.skill_slug;

-- ---------------------------------------------------------------------
-- Visible example test cases (1-2 per problem)
-- ---------------------------------------------------------------------
insert into problem_test_cases (problem_id, input, expected_output, is_hidden, is_edge_case, sort_order)
select p.id, tc.input, tc.expected_output, false, false, tc.sort_order
from problems p
join (values
  ('greeting-printer', 'Sam', 'Hello, Sam! Welcome to CodeForge.', 1),
  ('greeting-printer', 'Lee', 'Hello, Lee! Welcome to CodeForge.', 2),
  ('temperature-converter', '0', '32.0', 1),
  ('temperature-converter', '100', '212.0', 2),
  ('total-price-calculator', '100' || chr(10) || '0.08', '108.0', 1),
  ('total-price-calculator', '50' || chr(10) || '0.2', '60.0', 2),
  ('type-predictor', 'type(3 + 4.0)' || chr(10) || 'type("3" + "4")', 'float str', 1),
  ('even-odd-classifier', '4', 'even', 1),
  ('even-odd-classifier', '7', 'odd', 2),
  ('grade-classifier', '95', 'A', 1),
  ('grade-classifier', '72', 'C', 2),
  ('leap-year-checker', '2024', 'True', 1),
  ('leap-year-checker', '1900', 'False', 2),
  ('fizz-buzz-variant', '15', '1,2,Forge,4,Code,Forge,7,8,Forge,Code,11,Forge,13,14,ForgeCode', 1),
  ('fizz-buzz-variant', '5', '1,2,Forge,4,Code', 2),
  ('price-formatter', '12.5', '$12.50', 1),
  ('price-formatter', '3', '$3.00', 2),
  ('running-total-tracker', '[1,2,3]', '[1,3,6]', 1),
  ('running-total-tracker', '[5,0,5]', '[5,5,10]', 2),
  ('default-parameter-predictor', 'greet()' || chr(10) || 'greet("Sam")', 'Hi friend, Hi Sam', 1),
  ('largest-value', '[3,1,9,4]', '9', 1),
  ('largest-value', '[-5,-1,-10]', '-1', 2),
  ('seat-accessor', '["A1","A2","A3"]' || chr(10) || '1', 'A2', 1),
  ('seat-accessor', '["A1","A2"]' || chr(10) || '5', 'None', 2),
  ('occurrence-counter', '[1,2,2,3,2]' || chr(10) || '2', '3', 1),
  ('occurrence-counter', '[1,1,1]' || chr(10) || '5', '0', 2),
  ('array-reverser', '[1,2,3,4]', '[4,3,2,1]', 1),
  ('array-reverser', '[7]', '[7]', 2),
  ('duplicate-remover', '[1,2,2,3,1]', '[1,2,3]', 1),
  ('duplicate-remover', '[4,4,4]', '[4]', 2),
  ('inventory-total', '[{"price":10,"quantity":2},{"price":5,"quantity":3}]', '35', 1),
  ('inventory-total', '[{"price":2.5,"quantity":4}]', '10.0', 2),
  ('vowel-counter', 'CodeForge', '3', 1),
  ('vowel-counter', 'sky', '0', 2),
  ('palindrome-check', 'Level', 'True', 1),
  ('palindrome-check', 'Forge', 'False', 2),
  ('word-reverser', 'hi there', 'ih ereht', 1),
  ('word-reverser', 'code forge', 'edoc egrof', 2),
  ('character-frequency', 'success', 's', 1),
  ('character-frequency', 'aabbbcc', 'b', 2),
  ('pair-sum-finder', '[2,7,11,15]' || chr(10) || '9', '[0,1]', 1),
  ('pair-sum-finder', '[3,2,4]' || chr(10) || '6', '[1,2]', 2),
  ('anagram-pair-check', 'listen' || chr(10) || 'silent', 'True', 1),
  ('anagram-pair-check', 'hello' || chr(10) || 'world', 'False', 2),
  ('first-unique-character', 'swiss', '1', 1),
  ('first-unique-character', 'aabb', '-1', 2),
  ('unique-visitor-counter', '["sam","lee","sam","kai"]', '3', 1),
  ('unique-visitor-counter', '["a","a","a"]', '1', 2),
  ('common-elements-finder', '[1,2,3]' || chr(10) || '[2,3,4]', '[2,3]', 1),
  ('common-elements-finder', '[1,2]' || chr(10) || '[3,4]', '[]', 2),
  ('stack-balance-checker', '([]{})', 'True', 1),
  ('stack-balance-checker', '([)]', 'False', 2),
  ('undo-stack-simulator', '["add-photo","add-tag","undo","add-caption"]', '["add-photo","add-caption"]', 1),
  ('undo-stack-simulator', '["a","b","undo"]', '["a"]', 2),
  ('ticket-queue-simulator', '["Sam","Lee","Kai"]' || chr(10) || '2', '["Sam","Lee"]', 1),
  ('ticket-queue-simulator', '["A","B","C","D"]' || chr(10) || '1', '["A"]', 2),
  ('print-queue-order', 'append("a"); append("b"); append("c"); popleft(); popleft()', '["c"]', 1),
  ('linked-list-reverser', '1->2->3', '3->2->1', 1),
  ('linked-list-reverser', '1->2', '2->1', 2),
  ('middle-node-finder', '1->2->3->4->5', '3', 1),
  ('middle-node-finder', '1->2->3->4', '3', 2),
  ('missing-number-finder', '[3,0,1]', '2', 1),
  ('missing-number-finder', '[0,1]', '2', 2),
  ('linear-search-implementer', '[4,2,7]' || chr(10) || '7', '2', 1),
  ('linear-search-implementer', '[4,2,7]' || chr(10) || '5', '-1', 2),
  ('score-sorter', '[42,17,89,3]', '[3,17,42,89]', 1),
  ('score-sorter', '[5,5,1]', '[1,5,5]', 2),
  ('bubble-sort-tracer', '[5,2,4,1]', '[2,4,1,5]', 1),
  ('binary-search-implementer', '[1,3,5,7,9,11]' || chr(10) || '7', '3', 1),
  ('binary-search-implementer', '[1,3,5,7,9,11]' || chr(10) || '4', '-1', 2),
  ('insert-position-finder', '[1,3,5,7]' || chr(10) || '4', '2', 1),
  ('insert-position-finder', '[1,3,5,7]' || chr(10) || '8', '4', 2),
  ('factorial-recursive', '5', '120', 1),
  ('factorial-recursive', '0', '1', 2),
  ('digit-sum-recursive', '1234', '10', 1),
  ('digit-sum-recursive', '7', '7', 2),
  ('off-by-one-fixer', '[1,2,3,4]', '10', 1),
  ('off-by-one-fixer', '[5]', '5', 2),
  ('infinite-loop-fixer', '3', 'done', 1),
  ('infinite-loop-fixer', '1', 'done', 2)
) as tc(problem_slug, input, expected_output, sort_order) on tc.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- Hints — graded ladder (levels 1-3 for every problem; see HINT SYSTEM
-- FOUNDATION). Level 1 nudges toward the concept, level 3 gives a
-- concrete approach — never the full solution.
-- ---------------------------------------------------------------------
insert into hints (problem_id, level, content)
select p.id, h.level, h.content
from problems p
join (values
  ('greeting-printer', 1, 'You need to combine a fixed piece of text with a value that changes each call.'),
  ('greeting-printer', 2, 'String concatenation (+) or an f-string can insert a variable into a larger string.'),
  ('greeting-printer', 3, 'return f"Hello, {name}! Welcome to CodeForge."'),
  ('temperature-converter', 1, 'This is a direct formula translation — no branching needed.'),
  ('temperature-converter', 2, 'Watch operator precedence: multiplication happens before addition automatically.'),
  ('temperature-converter', 3, 'return round(celsius * 9 / 5 + 32, 1)'),
  ('total-price-calculator', 1, 'Tax is a percentage of the price, added on top of the price.'),
  ('total-price-calculator', 2, 'price * tax_rate gives the tax amount; add it to price.'),
  ('total-price-calculator', 3, 'return round(price + price * tax_rate, 2)'),
  ('type-predictor', 1, 'Think about what + means for two numbers versus two strings.'),
  ('type-predictor', 2, 'Adding an int and a float produces a float; the type is not always what you started with.'),
  ('type-predictor', 3, 'type(3 + 4.0) is float; type("3" + "4") is str, since + concatenates strings.'),
  ('even-odd-classifier', 1, 'The remainder when dividing by 2 tells you everything you need.'),
  ('even-odd-classifier', 2, 'n % 2 is 0 for even numbers and 1 (or -1) for odd numbers.'),
  ('even-odd-classifier', 3, 'return "even" if n % 2 == 0 else "odd"'),
  ('grade-classifier', 1, 'Check the highest threshold first, since ranges overlap if checked in the wrong order.'),
  ('grade-classifier', 2, 'Use if/elif in descending order: 90, then 80, then 70, then else.'),
  ('grade-classifier', 3, 'if score >= 90: return "A" — then elif score >= 80: return "B", and so on down to "F".'),
  ('leap-year-checker', 1, 'There are three separate rules, and they combine with and/or, not just one check.'),
  ('leap-year-checker', 2, 'Divisible by 4 is necessary but not sufficient — century years need an extra check.'),
  ('leap-year-checker', 3, 'return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)'),
  ('fizz-buzz-variant', 1, 'Check the "both" case before checking "3 only" or "5 only" individually.'),
  ('fizz-buzz-variant', 2, 'A number divisible by both 3 and 5 is also divisible by 15.'),
  ('fizz-buzz-variant', 3, 'if n % 15 == 0: "ForgeCode"; elif n % 3 == 0: "Forge"; elif n % 5 == 0: "Code"; else: str(n)'),
  ('price-formatter', 1, 'Python has a built-in way to format a number to a fixed number of decimal places.'),
  ('price-formatter', 2, 'The format spec :.2f rounds and pads a float to two decimals.'),
  ('price-formatter', 3, 'return f"${amount:.2f}"'),
  ('running-total-tracker', 1, 'You need to remember the sum so far as you move through the list.'),
  ('running-total-tracker', 2, 'Keep a running variable, add each element to it, and append it to a results list each time.'),
  ('running-total-tracker', 3, 'total = 0; result = []; for a in amounts: total += a; result.append(total); return result'),
  ('default-parameter-predictor', 1, 'A default parameter value is only used when the caller does not supply that argument.'),
  ('default-parameter-predictor', 2, 'Calling greet() with no arguments uses "friend"; calling greet("Sam") overrides it.'),
  ('default-parameter-predictor', 3, 'greet() returns "Hi friend"; greet("Sam") returns "Hi Sam".'),
  ('largest-value', 1, 'You only need to remember the biggest value seen so far as you scan.'),
  ('largest-value', 2, 'Start with the first element as your current best, then compare each remaining element to it.'),
  ('largest-value', 3, 'best = nums[0]; for n in nums[1:]: if n > best: best = n; return best'),
  ('seat-accessor', 1, 'Check whether the index is even valid before accessing it.'),
  ('seat-accessor', 2, 'A valid index satisfies 0 <= seat_number < len(seats).'),
  ('seat-accessor', 3, 'if 0 <= seat_number < len(seats): return seats[seat_number]; return None'),
  ('occurrence-counter', 1, 'A single pass with a counter is enough — no extra data structure needed.'),
  ('occurrence-counter', 2, 'Increment a counter every time the current element equals the target.'),
  ('occurrence-counter', 3, 'count = 0; for n in nums: if n == target: count += 1; return count'),
  ('array-reverser', 1, 'Swap elements from both ends moving toward the middle.'),
  ('array-reverser', 2, 'Use two indices, one starting at 0 and one at len-1, swap and move them toward each other.'),
  ('array-reverser', 3, 'left, right = 0, len(nums)-1; while left < right: nums[left], nums[right] = nums[right], nums[left]; left+=1; right-=1'),
  ('duplicate-remover', 1, 'You need to remember which values you have already added to the result.'),
  ('duplicate-remover', 2, 'A set gives fast membership checks for "have I seen this before?"'),
  ('duplicate-remover', 3, 'seen = set(); result = []; for n in nums: if n not in seen: seen.add(n); result.append(n); return result'),
  ('inventory-total', 1, 'Each item contributes price times quantity to the running total.'),
  ('inventory-total', 2, 'Loop through the items, multiply each item''s price and quantity, and accumulate.'),
  ('inventory-total', 3, 'return sum(item["price"] * item["quantity"] for item in items)'),
  ('vowel-counter', 1, 'Check each character against a fixed set of vowels, case-insensitively.'),
  ('vowel-counter', 2, 'Lowercase the string first so you only need to check five characters.'),
  ('vowel-counter', 3, 'return sum(1 for ch in text.lower() if ch in "aeiou")'),
  ('palindrome-check', 1, 'Compare characters from both ends moving inward, or compare the string to its reverse.'),
  ('palindrome-check', 2, 'Lowercase the string first, then compare it to itself reversed with slicing.'),
  ('palindrome-check', 3, 'cleaned = s.lower(); return cleaned == cleaned[::-1]'),
  ('word-reverser', 1, 'Break the sentence into words, transform each one, then put them back together.'),
  ('word-reverser', 2, 'split() gives you a list of words; reverse each with slicing; join() rebuilds the sentence.'),
  ('word-reverser', 3, 'return " ".join(word[::-1] for word in sentence.split())'),
  ('character-frequency', 1, 'Count how many times each character appears before deciding which is most frequent.'),
  ('character-frequency', 2, 'Build a dict of character -> count in one pass, then scan it for the maximum, preserving first-seen order on ties.'),
  ('character-frequency', 3, 'Use collections.Counter, then iterate the original string (not the counter) to break ties by first appearance.'),
  ('pair-sum-finder', 1, 'What would you need to know about a number you already saw, to instantly tell if it completes a pair?'),
  ('pair-sum-finder', 2, 'A hash map gives you average O(1) lookup by key as you scan once.'),
  ('pair-sum-finder', 3, 'seen = {}; for i, n in enumerate(nums): if target-n in seen: return [seen[target-n], i]; seen[n] = i'),
  ('anagram-pair-check', 1, 'Two words are anagrams exactly when they have the same letters in the same quantities.'),
  ('anagram-pair-check', 2, 'Sorting both strings should produce identical results if they are anagrams.'),
  ('anagram-pair-check', 3, 'return sorted(a.lower()) == sorted(b.lower())'),
  ('first-unique-character', 1, 'You need each character''s total count before you can tell if it repeats anywhere.'),
  ('first-unique-character', 2, 'Count all characters first, then scan left to right for the first one with count 1.'),
  ('first-unique-character', 3, 'counts = Counter(s); for i, ch in enumerate(s): if counts[ch] == 1: return i; return -1'),
  ('unique-visitor-counter', 1, 'A collection type exists that automatically discards duplicates.'),
  ('unique-visitor-counter', 2, 'Convert the list to a set, then measure its size.'),
  ('unique-visitor-counter', 3, 'return len(set(names))'),
  ('common-elements-finder', 1, 'A set operation exists specifically for "in both collections."'),
  ('common-elements-finder', 2, 'Convert both lists to sets and use the & (intersection) operator.'),
  ('common-elements-finder', 3, 'return list(set(a) & set(b))'),
  ('stack-balance-checker', 1, 'You need to remember which brackets are still open, most-recent first.'),
  ('stack-balance-checker', 2, 'Push opening brackets onto a stack; on a closing bracket, check it matches the top of the stack.'),
  ('stack-balance-checker', 3, 'Push opens; on close, pop and compare to the matching open — if mismatch or stack empty, return False. At the end, the stack must be empty.'),
  ('undo-stack-simulator', 1, 'Model the visible history as a stack that grows on an action and shrinks on undo.'),
  ('undo-stack-simulator', 2, 'Push non-undo actions; on "undo", pop the last pushed action instead.'),
  ('undo-stack-simulator', 3, 'history = []; for a in actions: history.pop() if a == "undo" else history.append(a); return history'),
  ('ticket-queue-simulator', 1, 'The people served are exactly the first N to join, in join order.'),
  ('ticket-queue-simulator', 2, 'A queue serves the oldest entries first — that is just the first N elements of the join order.'),
  ('ticket-queue-simulator', 3, 'return people[:count]'),
  ('print-queue-order', 1, 'Track what popleft() removes from the front each time it is called.'),
  ('print-queue-order', 2, 'After append("a"), append("b"), append("c"), the queue front-to-back is a, b, c.'),
  ('print-queue-order', 3, 'popleft() removes "a", then "b" — only "c" remains, so the answer is ["c"].'),
  ('linked-list-reverser', 1, 'You need to flip each node''s "next" pointer to point backward instead of forward.'),
  ('linked-list-reverser', 2, 'Walk the list with a "previous" pointer, redirecting each node''s next to previous before advancing.'),
  ('linked-list-reverser', 3, 'prev = None; while head: nxt = head.next; head.next = prev; prev = head; head = nxt; return prev'),
  ('middle-node-finder', 1, 'Two pointers moving at different speeds can find the middle in one pass.'),
  ('middle-node-finder', 2, 'Move a slow pointer one step and a fast pointer two steps; when fast reaches the end, slow is at the middle.'),
  ('middle-node-finder', 3, 'slow = fast = head; while fast and fast.next: slow = slow.next; fast = fast.next.next; return slow.value'),
  ('missing-number-finder', 1, 'The sum of 0..n has a simple formula you can compare against the actual sum.'),
  ('missing-number-finder', 2, 'expected_sum - actual_sum gives you the missing number directly.'),
  ('missing-number-finder', 3, 'n = len(nums); return n * (n + 1) // 2 - sum(nums)'),
  ('linear-search-implementer', 1, 'Check each element against the target, one at a time, remembering the position.'),
  ('linear-search-implementer', 2, 'Use enumerate() to get both the index and value as you loop.'),
  ('linear-search-implementer', 3, 'for i, n in enumerate(nums): if n == target: return i; return -1'),
  ('score-sorter', 1, 'Repeatedly find the smallest remaining value and place it next.'),
  ('score-sorter', 2, 'Selection sort: for each position, find the minimum of the remaining unsorted part and swap it into place.'),
  ('score-sorter', 3, 'For i in range(len(nums)): find index of min in nums[i:], swap it with nums[i].'),
  ('bubble-sort-tracer', 1, 'Walk left to right, swapping any adjacent pair that is out of order.'),
  ('bubble-sort-tracer', 2, 'Compare positions (0,1), then (1,2), then (2,3), swapping whenever the left is bigger.'),
  ('bubble-sort-tracer', 3, '[5,2,4,1] -> swap(5,2) -> [2,5,4,1] -> swap(5,4) -> [2,4,5,1] -> swap(5,1) -> [2,4,1,5]'),
  ('binary-search-implementer', 1, 'Compare the middle element to the target, then discard the half that cannot contain it.'),
  ('binary-search-implementer', 2, 'Track low and high bounds; if nums[mid] < target, search the right half, else search the left half.'),
  ('binary-search-implementer', 3, 'low, high = 0, len(nums)-1; while low <= high: mid = (low+high)//2; compare and move low or high; return -1 if not found'),
  ('insert-position-finder', 1, 'This is binary search, but you are looking for a boundary, not an exact match.'),
  ('insert-position-finder', 2, 'When the search space narrows to nothing, "low" ends up exactly at the correct insert index.'),
  ('insert-position-finder', 3, 'low, high = 0, len(nums); while low < high: mid = (low+high)//2; if nums[mid] < target: low = mid+1 else: high = mid; return low'),
  ('factorial-recursive', 1, 'What is the smallest input where the answer is obvious without recursing further?'),
  ('factorial-recursive', 2, 'factorial(0) is 1 — that is your base case; otherwise multiply n by factorial(n-1).'),
  ('factorial-recursive', 3, 'def factorial(n): return 1 if n == 0 else n * factorial(n - 1)'),
  ('digit-sum-recursive', 1, 'The last digit of a number is n % 10; the rest of the number is n // 10.'),
  ('digit-sum-recursive', 2, 'Base case: a single-digit number sums to itself. Otherwise, add the last digit to the recursive result on the rest.'),
  ('digit-sum-recursive', 3, 'def digit_sum(n): return n if n < 10 else n % 10 + digit_sum(n // 10)'),
  ('off-by-one-fixer', 1, 'Check exactly which indices range(1, len(nums)) actually covers.'),
  ('off-by-one-fixer', 2, 'range(1, len(nums)) skips index 0 entirely — the loop never includes the first element.'),
  ('off-by-one-fixer', 3, 'Change range(1, len(nums)) to range(len(nums)), or start total from nums[0] and loop from index 1.'),
  ('infinite-loop-fixer', 1, 'Look at what the while condition depends on, and whether that value ever changes inside the loop.'),
  ('infinite-loop-fixer', 2, 'n is never decremented, so "n > 0" stays true forever.'),
  ('infinite-loop-fixer', 3, 'Add n -= 1 inside the loop body so the condition eventually becomes false.')
) as h(problem_slug, level, content) on h.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- Mistake taxonomy — normalized, extensible (see COMMON MISTAKE SYSTEM).
-- Prompt 4's Mistake DNA reads this table.
-- ---------------------------------------------------------------------
insert into mistake_taxonomy (key, skill_id, title, description)
select mt.key, s.id, mt.title, mt.description
from (values
  ('OFF_BY_ONE', null, 'Off-by-one error', 'A loop or range boundary is shifted by one, skipping the first or last element, or going one too far.'),
  ('INFINITE_LOOP', 'control-flow', 'Infinite loop', 'A while loop''s condition never becomes false because nothing inside the loop changes the value it depends on.'),
  ('WRONG_BOUNDARY', 'control-flow', 'Wrong comparison boundary', 'Using < where <= was needed (or vice versa), causing a boundary value to be included or excluded incorrectly.'),
  ('UNINITIALIZED_VARIABLE', 'variables', 'Used before meaningfully assigned', 'Starting an accumulator or "best so far" variable at an arbitrary value instead of a value derived from the actual input.'),
  ('INDEX_OUT_OF_RANGE', 'arrays', 'Index out of range', 'Accessing an index that does not exist in the collection, often at a boundary the code did not account for.'),
  ('WRONG_INDEX', 'arrays', 'Wrong index', 'Using the wrong index — often confusing a 1-based mental model with Python''s 0-based indexing.'),
  ('EMPTY_INPUT_UNHANDLED', null, 'Empty input unhandled', 'The solution assumes the input always has at least one element and behaves incorrectly on an empty list or string.'),
  ('DUPLICATE_HANDLING', 'hash-maps', 'Incorrect duplicate handling', 'Failing to account for repeated values, either double-counting them or discarding one that should have been kept.'),
  ('MUTATING_WHILE_ITERATING', 'arrays', 'Mutating while iterating', 'Modifying a list''s contents while looping over it, which can skip elements or produce inconsistent results.'),
  ('CASE_SENSITIVITY_BUG', 'strings', 'Case-sensitivity bug', 'Comparing text without normalizing case first, so "Hello" and "hello" are treated as different values.'),
  ('INCORRECT_RETURN_TYPE', 'functions', 'Incorrect return type', 'Returning a value of a different type than the caller expects — or returning None by printing instead of using return.'),
  ('SHADOWING_VARIABLE', 'scope', 'Shadowing a variable', 'Reusing a name inside a narrower scope that unintentionally hides an outer variable of the same name.')
) as mt(key, skill_slug, title, description)
left join skills s on s.slug = mt.skill_slug;

-- ---------------------------------------------------------------------
-- Problem-specific common mistakes, linked to the taxonomy where it applies
-- ---------------------------------------------------------------------
insert into problem_common_mistakes (problem_id, description, detection_hint, mistake_key)
select p.id, cm.description, cm.detection_hint, cm.mistake_key
from problems p
join (values
  ('off-by-one-fixer', 'The loop starts at index 1, skipping nums[0] entirely.', 'output is short by exactly the first element''s value', 'OFF_BY_ONE'),
  ('infinite-loop-fixer', 'n is never decremented, so the while condition stays true forever.', 'submission times out instead of completing', 'INFINITE_LOOP'),
  ('array-reverser', 'Using left <= right instead of left < right performs one unnecessary self-swap at the middle element.', 'correct output but on an odd-length input', 'WRONG_BOUNDARY'),
  ('binary-search-implementer', 'Using low < high instead of low <= high can miss the case where the target is at the final remaining index.', 'fails only when target is the last candidate checked', 'WRONG_BOUNDARY'),
  ('seat-accessor', 'Accessing seats[seat_number] without checking bounds first crashes on an invalid seat number.', 'raises IndexError instead of returning None', 'INDEX_OUT_OF_RANGE'),
  ('stack-balance-checker', 'Popping from an empty stack when an unmatched closing bracket appears crashes instead of returning False.', 'raises an error on unbalanced input instead of returning False', 'INDEX_OUT_OF_RANGE'),
  ('largest-value', 'Starting the running best at 0 instead of nums[0] fails whenever every value in the list is negative.', 'fails only on all-negative inputs', 'UNINITIALIZED_VARIABLE'),
  ('duplicate-remover', 'Appending to the result before checking the seen set lets duplicates slip through.', 'output still contains repeated values', 'DUPLICATE_HANDLING'),
  ('pair-sum-finder', 'Returning the same index twice when a value could pair with itself.', 'output contains a repeated index', 'DUPLICATE_HANDLING'),
  ('palindrome-check', 'Comparing without lowercasing first fails on mixed-case inputs like "Level".', 'fails only on mixed-case inputs', 'CASE_SENSITIVITY_BUG'),
  ('anagram-pair-check', 'Comparing sorted strings without lowercasing first treats "Listen" and "silent" as different.', 'fails only on mixed-case inputs', 'CASE_SENSITIVITY_BUG'),
  ('greeting-printer', 'Printing the greeting inside the function instead of returning it means callers get None back.', 'returned value is None instead of the greeting string', 'INCORRECT_RETURN_TYPE'),
  ('running-total-tracker', 'Reusing a loop variable named the same as an outer accumulator can silently shadow it.', 'accumulated total resets unexpectedly partway through', 'SHADOWING_VARIABLE'),
  ('unique-visitor-counter', 'Assuming there is always at least one visitor — an empty list should correctly return 0, not raise an error.', 'fails only on an empty input list', 'EMPTY_INPUT_UNHANDLED')
) as cm(problem_slug, description, detection_hint, mistake_key) on cm.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- Starter code — Python for every problem; JavaScript for a representative
-- subset, to keep the language registry structurally real without
-- duplicating the full bank six times (see LANGUAGE STRATEGY).
-- ---------------------------------------------------------------------
insert into problem_starter_code (problem_id, language_id, starter_code)
select p.id, (select id from languages where slug = 'python'), sc.code
from problems p
join (values
  ('greeting-printer', 'def greet(name):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('temperature-converter', 'def to_fahrenheit(celsius):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('total-price-calculator', 'def total_with_tax(price, tax_rate):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('type-predictor', '# No code to write — answer in the response box.' || chr(10) || 'print(type(3 + 4.0))' || chr(10) || 'print(type("3" + "4"))'),
  ('even-odd-classifier', 'def classify(n):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('grade-classifier', 'def letter_grade(score):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('leap-year-checker', 'def is_leap_year(year):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('fizz-buzz-variant', 'def fizz_buzz(n):' || chr(10) || '    # your code here — return a comma-separated string' || chr(10) || '    pass'),
  ('price-formatter', 'def format_price(amount):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('running-total-tracker', 'def running_totals(amounts):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('default-parameter-predictor', '# No code to write — answer in the response box.' || chr(10) || 'def greet(name="friend"):' || chr(10) || '    return "Hi " + name'),
  ('largest-value', 'def largest_value(nums):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('seat-accessor', 'def get_seat(seats, seat_number):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('occurrence-counter', 'def count_occurrences(nums, target):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('array-reverser', 'def reverse_in_place(nums):' || chr(10) || '    # your code here — mutate nums, do not return a new list' || chr(10) || '    pass'),
  ('duplicate-remover', 'def remove_duplicates(nums):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('inventory-total', 'def inventory_total(items):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('vowel-counter', 'def count_vowels(text):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('palindrome-check', 'def is_palindrome(s):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('word-reverser', 'def reverse_words(sentence):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('character-frequency', 'def most_frequent_char(text):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('pair-sum-finder', 'def pair_sum(nums, target):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('anagram-pair-check', 'def is_anagram(a, b):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('first-unique-character', 'def first_unique_index(s):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('unique-visitor-counter', 'def count_unique_visitors(names):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('common-elements-finder', 'def common_elements(a, b):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('stack-balance-checker', 'def is_balanced(s):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('undo-stack-simulator', 'def apply_actions(actions):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('ticket-queue-simulator', 'def serve(people, count):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('print-queue-order', '# No code to write — answer in the response box.' || chr(10) || 'from collections import deque' || chr(10) || 'q = deque()' || chr(10) || 'q.append("a"); q.append("b"); q.append("c")' || chr(10) || 'q.popleft(); q.popleft()'),
  ('linked-list-reverser', 'class Node:' || chr(10) || '    def __init__(self, value, next=None):' || chr(10) || '        self.value = value' || chr(10) || '        self.next = next' || chr(10) || chr(10) || 'def reverse_list(head):' || chr(10) || '    # your code here — return the new head' || chr(10) || '    pass'),
  ('middle-node-finder', 'def find_middle(head):' || chr(10) || '    # your code here — return the middle node''s value' || chr(10) || '    pass'),
  ('missing-number-finder', 'def find_missing(nums):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('linear-search-implementer', 'def linear_search(nums, target):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('score-sorter', 'def sort_scores(nums):' || chr(10) || '    # your code here — no sorted() or .sort()' || chr(10) || '    pass'),
  ('bubble-sort-tracer', '# No code to write — answer in the response box.' || chr(10) || 'nums = [5, 2, 4, 1]' || chr(10) || '# trace one left-to-right pass of adjacent swaps'),
  ('binary-search-implementer', 'def binary_search(nums, target):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('insert-position-finder', 'def find_insert_position(nums, target):' || chr(10) || '    # your code here' || chr(10) || '    pass'),
  ('factorial-recursive', 'def factorial(n):' || chr(10) || '    # your code here — must be recursive' || chr(10) || '    pass'),
  ('digit-sum-recursive', 'def digit_sum(n):' || chr(10) || '    # your code here — must be recursive' || chr(10) || '    pass'),
  ('off-by-one-fixer', 'def sum_list(nums):' || chr(10) || '    total = 0' || chr(10) || '    for i in range(1, len(nums)):' || chr(10) || '        total += nums[i]' || chr(10) || '    return total'),
  ('infinite-loop-fixer', 'def countdown(n):' || chr(10) || '    while n > 0:' || chr(10) || '        print(n)' || chr(10) || '    return "done"')
) as sc(problem_slug, code) on sc.problem_slug = p.slug;

insert into problem_starter_code (problem_id, language_id, starter_code)
select p.id, (select id from languages where slug = 'javascript'), sc.code
from problems p
join (values
  ('greeting-printer', 'function greet(name) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('even-odd-classifier', 'function classify(n) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('largest-value', 'function largestValue(nums) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('seat-accessor', 'function getSeat(seats, seatNumber) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('vowel-counter', 'function countVowels(text) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('palindrome-check', 'function isPalindrome(s) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('pair-sum-finder', 'function pairSum(nums, target) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('stack-balance-checker', 'function isBalanced(s) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('linked-list-reverser', 'class Node {' || chr(10) || '  constructor(value, next = null) {' || chr(10) || '    this.value = value;' || chr(10) || '    this.next = next;' || chr(10) || '  }' || chr(10) || '}' || chr(10) || chr(10) || 'function reverseList(head) {' || chr(10) || '  // your code here — return the new head' || chr(10) || '}'),
  ('missing-number-finder', 'function findMissing(nums) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('score-sorter', 'function sortScores(nums) {' || chr(10) || '  // your code here — no .sort()' || chr(10) || '}'),
  ('binary-search-implementer', 'function binarySearch(nums, target) {' || chr(10) || '  // your code here' || chr(10) || '}'),
  ('factorial-recursive', 'function factorial(n) {' || chr(10) || '  // your code here — must be recursive' || chr(10) || '}'),
  ('off-by-one-fixer', 'function sumList(nums) {' || chr(10) || '  let total = 0;' || chr(10) || '  for (let i = 1; i < nums.length; i++) {' || chr(10) || '    total += nums[i];' || chr(10) || '  }' || chr(10) || '  return total;' || chr(10) || '}'),
  ('unique-visitor-counter', 'function countUniqueVisitors(names) {' || chr(10) || '  // your code here' || chr(10) || '}')
) as sc(problem_slug, code) on sc.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- Lesson -> next problem links (see LESSON DESIGN §9 CODE CHALLENGE).
-- Run after problems exist. Not every lesson gets one — only where a
-- problem genuinely applies what that specific lesson just taught.
-- ---------------------------------------------------------------------
update lessons l set next_problem_id = p.id
from (values
  ('naming-a-value', 'greeting-printer'),
  ('combining-values', 'temperature-converter'),
  ('making-a-decision', 'even-odd-classifier'),
  ('repeating-work', 'fizz-buzz-variant'),
  ('packaging-logic', 'price-formatter'),
  ('parameters-and-returns', 'running-total-tracker'),
  ('storing-a-sequence', 'largest-value'),
  ('text-as-a-sequence', 'vowel-counter'),
  ('key-value-lookup', 'pair-sum-finder'),
  ('unique-collections', 'unique-visitor-counter'),
  ('last-in-first-out', 'stack-balance-checker'),
  ('first-in-first-out', 'ticket-queue-simulator'),
  ('finding-things', 'linear-search-implementer'),
  ('putting-things-in-order', 'score-sorter'),
  ('divide-and-conquer-search', 'binary-search-implementer'),
  ('functions-that-call-themselves', 'factorial-recursive'),
  ('reading-error-messages', 'off-by-one-fixer')
) as link(lesson_slug, problem_slug)
join problems p on p.slug = link.problem_slug
where l.slug = link.lesson_slug;

-- =======================================================================
-- Prompt 3 — Execution Engine: executable problems
--
-- Everything below is verified, not guessed: every reference solution was
-- actually run (Python/C/C++/Java via the live Wandbox API, SQL via a
-- local Postgres instance) before being written here as an expected_output
-- — see the Prompt 3 report for how. `comparison_mode = 'trim'` is used
-- throughout so a trailing newline difference between languages never
-- fails a correct solution, while still requiring exact content otherwise.
-- =======================================================================

insert into skills (slug, name, description, category, difficulty) values
  ('sql-select-where', 'SQL: Select & Filter', 'Choosing columns and filtering rows with SELECT and WHERE.', 'databases', 1),
  ('sql-aggregation', 'SQL: Aggregation', 'Summarizing rows with COUNT, SUM, AVG, GROUP BY, and HAVING.', 'databases', 2),
  ('sql-joins-subqueries', 'SQL: Joins & Subqueries', 'Combining tables with JOIN and nesting queries with subqueries.', 'databases', 3);

insert into skill_dependencies (skill_id, prerequisite_skill_id)
select s.id, p.id from skills s, skills p where
  (s.slug, p.slug) in (
    ('sql-aggregation', 'sql-select-where'),
    ('sql-joins-subqueries', 'sql-aggregation')
  );

-- ---------------------------------------------------------------------
-- 8 executable problems: Python / C / C++ / Java, real stdin/stdout
-- ---------------------------------------------------------------------
insert into problems (
  slug, title, statement, difficulty, problem_type, progression_level,
  learning_objective, constraints, expected_time_complexity, expected_space_complexity,
  is_published, is_executable, time_limit_ms, memory_limit_mb
)
values
  ('sum-of-two-numbers', 'Sum of Two Numbers',
   'Read two integers from standard input, separated by a space, and print their sum.',
   'intro', 'implementation', 1,
   'Practice the platform''s stdin/stdout contract with the simplest possible program.',
   'The two integers fit in a 32-bit signed integer.', 'O(1)', 'O(1)', true, true, 2000, 128),
  ('reverse-a-list', 'Reverse a List of Numbers',
   'Read an integer n, then n space-separated integers on the next line. Print them in reverse order, space-separated, on one line.',
   'easy', 'implementation', 2,
   'Practice reading a sized array from stdin and reversing it.',
   '1 <= n <= 1000.', 'O(n)', 'O(n)', true, true, 2000, 128),
  ('maximum-of-n-numbers', 'Maximum of N Numbers',
   'Read an integer n, then n space-separated integers on the next line. Print the largest one.',
   'intro', 'implementation', 1,
   'Practice a linear scan for the maximum, reading array-sized input.',
   '1 <= n <= 1000.', 'O(n)', 'O(1)', true, true, 2000, 128),
  ('even-or-odd-checker', 'Even or Odd Checker',
   'Read a single integer n. Print "even" if it is even, or "odd" if it is odd.',
   'intro', 'implementation', 1,
   'Practice a single conditional with real stdin/stdout across languages.',
   'n may be negative.', 'O(1)', 'O(1)', true, true, 2000, 128),
  ('factorial-calculator', 'Factorial Calculator',
   'Read a single non-negative integer n. Print n! (n factorial). 0! is 1.',
   'easy', 'implementation', 2,
   'Practice a loop or recursive accumulation with real execution.',
   '0 <= n <= 12 (fits in a 32-bit integer).', 'O(n)', 'O(1)', true, true, 2000, 128),
  ('palindrome-string-check', 'Palindrome String Check',
   'Read a single word from standard input. Print "YES" if it reads the same forwards and backwards, or "NO" otherwise.',
   'easy', 'implementation', 2,
   'Practice string traversal/reversal with real stdin/stdout.',
   'The input contains only lowercase letters, no spaces.', 'O(n)', 'O(1)', true, true, 2000, 128),
  ('forge-buzz-executable', 'Forge Buzz',
   'Read an integer n. Print the numbers 1 to n, one per line. For multiples of 3 print "Forge" instead of the number, for multiples of 5 print "Code", and for multiples of both print "ForgeCode".',
   'easy', 'implementation', 3,
   'Practice combining multiple conditions correctly with real multi-line output.',
   '1 <= n <= 1000.', 'O(n)', 'O(1)', true, true, 2000, 128),
  ('sum-of-digits', 'Sum of Digits',
   'Read a non-negative integer (as a string is fine — it may be long). Print the sum of its digits.',
   'easy', 'implementation', 2,
   'Practice digit extraction, a common building block for numeric problems.',
   'The number has at most 18 digits.', 'O(d)', 'O(1)', true, true, 2000, 128);

insert into problem_skills (problem_id, skill_id, relationship)
select p.id, s.id, 'teaches'
from problems p
join (values
  ('sum-of-two-numbers', 'operators'),
  ('reverse-a-list', 'arrays'),
  ('maximum-of-n-numbers', 'arrays'),
  ('even-or-odd-checker', 'control-flow'),
  ('factorial-calculator', 'recursion'),
  ('palindrome-string-check', 'strings'),
  ('forge-buzz-executable', 'control-flow'),
  ('sum-of-digits', 'recursion')
) as ps(problem_slug, skill_slug) on ps.problem_slug = p.slug
join skills s on s.slug = ps.skill_slug;

-- Test cases — verified via real execution (see header note). 2 visible + 1 hidden each.
insert into problem_test_cases (problem_id, input, expected_output, is_hidden, is_edge_case, sort_order, comparison_mode, weight)
select p.id, tc.input, tc.expected_output, tc.is_hidden, tc.is_edge_case, tc.sort_order, 'trim', 1
from problems p
join (values
  ('sum-of-two-numbers', '3 5', '8', false, false, 1),
  ('sum-of-two-numbers', '10 -3', '7', false, true, 2),
  ('sum-of-two-numbers', '-8 -8', '-16', true, true, 3),

  ('reverse-a-list', '5' || chr(10) || '1 2 3 4 5', '5 4 3 2 1', false, false, 1),
  ('reverse-a-list', '3' || chr(10) || '7 8 9', '9 8 7', false, false, 2),
  ('reverse-a-list', '1' || chr(10) || '42', '42', true, true, 3),

  ('maximum-of-n-numbers', '4' || chr(10) || '3 9 1 7', '9', false, false, 1),
  ('maximum-of-n-numbers', '3' || chr(10) || '-5 -1 -10', '-1', false, true, 2),
  ('maximum-of-n-numbers', '1' || chr(10) || '5', '5', true, true, 3),

  ('even-or-odd-checker', '7', 'odd', false, false, 1),
  ('even-or-odd-checker', '4', 'even', false, false, 2),
  ('even-or-odd-checker', '0', 'even', true, true, 3),

  ('factorial-calculator', '5', '120', false, false, 1),
  ('factorial-calculator', '0', '1', false, true, 2),
  ('factorial-calculator', '10', '3628800', true, false, 3),

  ('palindrome-string-check', 'level', 'YES', false, false, 1),
  ('palindrome-string-check', 'forge', 'NO', false, false, 2),
  ('palindrome-string-check', 'a', 'YES', true, true, 3),

  ('forge-buzz-executable', '15', '1' || chr(10) || '2' || chr(10) || 'Forge' || chr(10) || '4' || chr(10) || 'Code' || chr(10) || 'Forge' || chr(10) || '7' || chr(10) || '8' || chr(10) || 'Forge' || chr(10) || 'Code' || chr(10) || '11' || chr(10) || 'Forge' || chr(10) || '13' || chr(10) || '14' || chr(10) || 'ForgeCode', false, false, 1),
  ('forge-buzz-executable', '3', '1' || chr(10) || '2' || chr(10) || 'Forge', false, false, 2),
  ('forge-buzz-executable', '5', '1' || chr(10) || '2' || chr(10) || 'Forge' || chr(10) || '4' || chr(10) || 'Code', true, true, 3),

  ('sum-of-digits', '1234', '10', false, false, 1),
  ('sum-of-digits', '7', '7', false, true, 2),
  ('sum-of-digits', '999999999', '81', true, false, 3)
) as tc(problem_slug, input, expected_output, is_hidden, is_edge_case, sort_order) on tc.problem_slug = p.slug;

insert into hints (problem_id, level, content)
select p.id, h.level, h.content
from problems p
join (values
  ('sum-of-two-numbers', 1, 'Read one line, split it into two numbers, and print their sum.'),
  ('sum-of-two-numbers', 2, 'Most languages have a built-in way to split a line of input by whitespace into two values.'),
  ('reverse-a-list', 1, 'Read the count first, then the list — you need the count to know how many numbers follow.'),
  ('reverse-a-list', 2, 'Store the numbers in an array, then print it from the last index to the first.'),
  ('maximum-of-n-numbers', 1, 'Track a running best value as you read each number.'),
  ('maximum-of-n-numbers', 2, 'Initialize your running best to the first number read, then compare each subsequent one.'),
  ('even-or-odd-checker', 1, 'The remainder when dividing by 2 tells you everything you need.'),
  ('even-or-odd-checker', 2, 'Watch out for negative numbers — the modulo operator behaves differently across languages for negatives, but evenness is still just "divisible by 2".'),
  ('factorial-calculator', 1, 'A simple loop multiplying 1 through n works — recursion is not required.'),
  ('factorial-calculator', 2, 'Start your accumulator at 1, not 0 — multiplying by 0 would zero everything out.'),
  ('palindrome-string-check', 1, 'Compare the string to its own reverse.'),
  ('palindrome-string-check', 2, 'A two-pointer approach (compare first/last, move inward) avoids needing to build a reversed copy.'),
  ('forge-buzz-executable', 1, 'Check divisibility by 15 before checking 3 or 5 individually.'),
  ('forge-buzz-executable', 2, 'A number divisible by both 3 and 5 is exactly the numbers divisible by 15.'),
  ('sum-of-digits', 1, 'Reading the number as a string lets you iterate over its digits directly.'),
  ('sum-of-digits', 2, 'Each character digit can be converted back to its integer value and added to a running total.')
) as h(problem_slug, level, content) on h.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- Starter code — Python / C / C++ / Java for every executable problem.
-- See lib/execution/registry.ts: Java uses a non-public top-level class,
-- a real constraint of the execution provider, not a style choice.
-- ---------------------------------------------------------------------
insert into problem_starter_code (problem_id, language_id, starter_code)
select p.id, (select id from languages where slug = sc.language_slug), sc.code
from problems p
join (values
  ('sum-of-two-numbers', 'python', 'a, b = map(int, input().split())' || chr(10) || '# your code here'),
  ('sum-of-two-numbers', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int a, b;' || chr(10) || '    scanf("%d %d", &a, &b);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('sum-of-two-numbers', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int a, b;' || chr(10) || '    cin >> a >> b;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('sum-of-two-numbers', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int a = sc.nextInt(), b = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('reverse-a-list', 'python', 'n = int(input())' || chr(10) || 'nums = list(map(int, input().split()))' || chr(10) || '# your code here'),
  ('reverse-a-list', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int n;' || chr(10) || '    scanf("%d", &n);' || chr(10) || '    int nums[1000];' || chr(10) || '    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('reverse-a-list', 'cpp', '#include <iostream>' || chr(10) || '#include <vector>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int n; cin >> n;' || chr(10) || '    vector<int> nums(n);' || chr(10) || '    for (auto &x : nums) cin >> x;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('reverse-a-list', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int n = sc.nextInt();' || chr(10) || '        int[] nums = new int[n];' || chr(10) || '        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('maximum-of-n-numbers', 'python', 'n = int(input())' || chr(10) || 'nums = list(map(int, input().split()))' || chr(10) || '# your code here'),
  ('maximum-of-n-numbers', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int n;' || chr(10) || '    scanf("%d", &n);' || chr(10) || '    int nums[1000];' || chr(10) || '    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('maximum-of-n-numbers', 'cpp', '#include <iostream>' || chr(10) || '#include <vector>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int n; cin >> n;' || chr(10) || '    vector<int> nums(n);' || chr(10) || '    for (auto &x : nums) cin >> x;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('maximum-of-n-numbers', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int n = sc.nextInt();' || chr(10) || '        int[] nums = new int[n];' || chr(10) || '        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('even-or-odd-checker', 'python', 'n = int(input())' || chr(10) || '# your code here'),
  ('even-or-odd-checker', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int n;' || chr(10) || '    scanf("%d", &n);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('even-or-odd-checker', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int n; cin >> n;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('even-or-odd-checker', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int n = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('factorial-calculator', 'python', 'n = int(input())' || chr(10) || '# your code here'),
  ('factorial-calculator', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int n;' || chr(10) || '    scanf("%d", &n);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('factorial-calculator', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int n; cin >> n;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('factorial-calculator', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int n = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('palindrome-string-check', 'python', 's = input().strip()' || chr(10) || '# your code here'),
  ('palindrome-string-check', 'c', '#include <stdio.h>' || chr(10) || '#include <string.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    char s[1000];' || chr(10) || '    scanf("%s", s);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('palindrome-string-check', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    string s; cin >> s;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('palindrome-string-check', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        String s = sc.next();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('forge-buzz-executable', 'python', 'n = int(input())' || chr(10) || '# your code here'),
  ('forge-buzz-executable', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    int n;' || chr(10) || '    scanf("%d", &n);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('forge-buzz-executable', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    int n; cin >> n;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('forge-buzz-executable', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        int n = sc.nextInt();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}'),

  ('sum-of-digits', 'python', 'n = input().strip()' || chr(10) || '# your code here'),
  ('sum-of-digits', 'c', '#include <stdio.h>' || chr(10) || chr(10) || 'int main(void) {' || chr(10) || '    char n[20];' || chr(10) || '    scanf("%s", n);' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('sum-of-digits', 'cpp', '#include <iostream>' || chr(10) || 'using namespace std;' || chr(10) || chr(10) || 'int main() {' || chr(10) || '    string n; cin >> n;' || chr(10) || '    // your code here' || chr(10) || '    return 0;' || chr(10) || '}'),
  ('sum-of-digits', 'java', 'import java.util.Scanner;' || chr(10) || chr(10) || 'class Main {' || chr(10) || '    public static void main(String[] args) {' || chr(10) || '        Scanner sc = new Scanner(System.in);' || chr(10) || '        String n = sc.next();' || chr(10) || '        // your code here' || chr(10) || '    }' || chr(10) || '}')
) as sc(problem_slug, language_slug, code) on sc.problem_slug = p.slug;

-- ---------------------------------------------------------------------
-- 10 SQL problems, two isolated datasets. Every expected_output below is
-- the literal JSON `rows` array produced by actually running the
-- reference query against this exact schema+seed in a real Postgres
-- instance (see the Prompt 3 report) — not computed by hand. Graded with
-- comparison_mode = 'unordered_rows': row order never affects grading,
-- only the set of rows returned.
-- ---------------------------------------------------------------------
insert into problems (
  slug, title, statement, difficulty, problem_type, progression_level,
  learning_objective, constraints, expected_time_complexity, expected_space_complexity,
  is_published, is_executable, time_limit_ms, memory_limit_mb
)
values
  ('sql-select-where', 'High Earners',
   'The `employees` table has columns id, name, department_id, salary, hire_year. The `departments` table has columns id, name. List the name and salary of every employee earning more than 80000.',
   'intro', 'implementation', 1,
   'Practice a basic SELECT with a WHERE filter.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-count-group-by', 'Headcount by Department',
   'Using the same employees/departments tables, count how many employees work in each department. Return the department name and the count.',
   'easy', 'implementation', 2,
   'Practice GROUP BY with COUNT across a join.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-avg-salary-by-department', 'Average Salary by Department',
   'Using the same employees/departments tables, compute the average salary per department, rounded to the nearest whole number. Return the department name and the rounded average.',
   'medium', 'implementation', 3,
   'Practice AVG with GROUP BY, and rounding a numeric result.',
   'Round with ROUND(...)::int so the result is a plain integer. Row order does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-having-filter', 'Departments With Multiple Employees',
   'Using the same employees/departments tables, return the name and employee count of every department that has more than one employee.',
   'medium', 'implementation', 3,
   'Practice filtering on an aggregate with HAVING, not WHERE.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-subquery-above-average', 'Above-Average Earners',
   'Using the same employees table, list the names of employees whose salary is above the company-wide average salary.',
   'medium', 'implementation', 4,
   'Practice a scalar subquery used inside a WHERE clause.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-join-having-sum', 'High-Spend Departments',
   'Using the same employees/departments tables, return the department name and total salary spend (SUM) for every department whose total salary spend exceeds 100000.',
   'medium', 'implementation', 4,
   'Practice combining JOIN, SUM, and HAVING in one query.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-inner-join-basic', 'Student Enrollments',
   'The `students` table has columns id, name, year. The `courses` table has columns id, title, credits. The `enrollments` table has columns id, student_id, course_id, grade. List every student''s name alongside the title of each course they are enrolled in.',
   'easy', 'implementation', 2,
   'Practice a basic multi-table INNER JOIN.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-count-enrollment-per-course', 'Enrollment Counts',
   'Using the same students/courses/enrollments tables, count how many students are enrolled in each course. Return the course title and the count.',
   'medium', 'implementation', 3,
   'Practice COUNT with GROUP BY across a join.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-having-min-enrollment', 'Popular Courses',
   'Using the same students/courses/enrollments tables, return the title of every course with more than 2 students enrolled.',
   'medium', 'implementation', 4,
   'Practice HAVING on a joined aggregate.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64),
  ('sql-subquery-students-with-a', 'Students With an A',
   'Using the same students/courses/enrollments tables, list the distinct names of students who have received a grade of ''A'' in at least one course.',
   'medium', 'implementation', 4,
   'Practice a subquery with IN, plus DISTINCT.',
   'Row order in your result does not affect grading.', null, null, true, true, 2000, 64);

insert into problem_skills (problem_id, skill_id, relationship)
select p.id, s.id, 'teaches'
from problems p
join (values
  ('sql-select-where', 'sql-select-where'),
  ('sql-count-group-by', 'sql-aggregation'),
  ('sql-avg-salary-by-department', 'sql-aggregation'),
  ('sql-having-filter', 'sql-aggregation'),
  ('sql-subquery-above-average', 'sql-joins-subqueries'),
  ('sql-join-having-sum', 'sql-joins-subqueries'),
  ('sql-inner-join-basic', 'sql-joins-subqueries'),
  ('sql-count-enrollment-per-course', 'sql-aggregation'),
  ('sql-having-min-enrollment', 'sql-joins-subqueries'),
  ('sql-subquery-students-with-a', 'sql-joins-subqueries')
) as ps(problem_slug, skill_slug) on ps.problem_slug = p.slug
join skills s on s.slug = ps.skill_slug;

-- Isolated datasets — never the app's real database. See services/execution/sql-sandbox.ts.
insert into sql_problem_datasets (problem_id, schema_sql, seed_sql)
select p.id, d.schema_sql, d.seed_sql
from problems p
join (values
  ('employees_departments',
   'create table departments (id int primary key, name text not null);' || chr(10) ||
   'create table employees (id int primary key, name text not null, department_id int references departments(id), salary int not null, hire_year int not null);',
   'insert into departments (id, name) values (1,''Engineering''),(2,''Sales''),(3,''Marketing'');' || chr(10) ||
   'insert into employees (id, name, department_id, salary, hire_year) values ' ||
   '(1,''Alice'',1,95000,2019),(2,''Bob'',2,72000,2021),(3,''Carol'',1,88000,2020),(4,''Dave'',3,65000,2022),(5,''Eve'',2,79000,2018),(6,''Frank'',1,102000,2017);'),
  ('students_courses',
   'create table courses (id int primary key, title text not null, credits int not null);' || chr(10) ||
   'create table students (id int primary key, name text not null, year int not null);' || chr(10) ||
   'create table enrollments (id int primary key, student_id int references students(id), course_id int references courses(id), grade text not null);',
   'insert into courses (id, title, credits) values (1,''Algorithms'',4),(2,''Databases'',3),(3,''Networks'',3);' || chr(10) ||
   'insert into students (id, name, year) values (1,''Sam'',2),(2,''Lee'',3),(3,''Kai'',1),(4,''Nina'',2);' || chr(10) ||
   'insert into enrollments (id, student_id, course_id, grade) values (1,1,1,''A''),(2,1,2,''B''),(3,2,1,''A''),(4,2,3,''C''),(5,3,2,''A''),(6,4,1,''B''),(7,4,3,''A'');')
) as d(dataset_key, schema_sql, seed_sql)
  on d.dataset_key = (case
    when p.slug in ('sql-select-where','sql-count-group-by','sql-avg-salary-by-department','sql-having-filter','sql-subquery-above-average','sql-join-having-sum')
      then 'employees_departments'
    else 'students_courses'
  end)
where p.slug in (
  'sql-select-where','sql-count-group-by','sql-avg-salary-by-department','sql-having-filter','sql-subquery-above-average','sql-join-having-sum',
  'sql-inner-join-basic','sql-count-enrollment-per-course','sql-having-min-enrollment','sql-subquery-students-with-a'
);

-- One test case per SQL problem — the query is executed once and graded
-- against this single expected row set (see services/execution/judge.ts).
insert into problem_test_cases (problem_id, input, expected_output, is_hidden, is_edge_case, sort_order, comparison_mode, weight)
select p.id, '', tc.expected_output, false, false, 1, 'unordered_rows', 1
from problems p
join (values
  ('sql-select-where', '[["Frank",102000],["Alice",95000],["Carol",88000]]'),
  ('sql-count-group-by', '[["Engineering",3],["Marketing",1],["Sales",2]]'),
  ('sql-avg-salary-by-department', '[["Engineering",95000],["Sales",75500],["Marketing",65000]]'),
  ('sql-having-filter', '[["Engineering",3],["Sales",2]]'),
  ('sql-subquery-above-average', '[["Alice"],["Carol"],["Frank"]]'),
  ('sql-join-having-sum', '[["Engineering",285000],["Sales",151000]]'),
  ('sql-inner-join-basic', '[["Kai","Databases"],["Lee","Algorithms"],["Lee","Networks"],["Nina","Algorithms"],["Nina","Networks"],["Sam","Algorithms"],["Sam","Databases"]]'),
  ('sql-count-enrollment-per-course', '[["Algorithms",3],["Databases",2],["Networks",2]]'),
  ('sql-having-min-enrollment', '[["Algorithms"]]'),
  ('sql-subquery-students-with-a', '[["Kai"],["Lee"],["Nina"],["Sam"]]')
) as tc(problem_slug, expected_output) on tc.problem_slug = p.slug;

insert into hints (problem_id, level, content)
select p.id, h.level, h.content
from problems p
join (values
  ('sql-select-where', 1, 'A WHERE clause filters rows before they are returned.'),
  ('sql-select-where', 2, 'SELECT name, salary FROM employees WHERE salary > 80000;'),
  ('sql-count-group-by', 1, 'GROUP BY collapses rows that share a value into one row per group.'),
  ('sql-count-group-by', 2, 'Join employees to departments, GROUP BY department name, and use COUNT(*).'),
  ('sql-avg-salary-by-department', 1, 'AVG works the same way COUNT does — one aggregate value per group.'),
  ('sql-avg-salary-by-department', 2, 'Wrap the AVG in ROUND(...)::int to get a clean whole-number result.'),
  ('sql-having-filter', 1, 'WHERE filters rows before grouping; HAVING filters groups after aggregation.'),
  ('sql-having-filter', 2, 'GROUP BY department name, then add HAVING COUNT(*) > 1.'),
  ('sql-subquery-above-average', 1, 'A subquery in parentheses can stand in for a single value, like an average.'),
  ('sql-subquery-above-average', 2, 'WHERE salary > (SELECT AVG(salary) FROM employees)'),
  ('sql-join-having-sum', 1, 'This combines everything: JOIN to connect tables, SUM to total, HAVING to filter the total.'),
  ('sql-join-having-sum', 2, 'GROUP BY department name, SUM(salary) AS total, then HAVING SUM(salary) > 100000.'),
  ('sql-inner-join-basic', 1, 'You need three tables connected: students, enrollments, and courses.'),
  ('sql-inner-join-basic', 2, 'JOIN enrollments to students on student_id, and to courses on course_id.'),
  ('sql-count-enrollment-per-course', 1, 'Group by course, not by student, this time.'),
  ('sql-count-enrollment-per-course', 2, 'JOIN enrollments to courses, GROUP BY course title, COUNT(*).'),
  ('sql-having-min-enrollment', 1, 'Group by course and filter the group size with HAVING.'),
  ('sql-having-min-enrollment', 2, 'GROUP BY c.title HAVING COUNT(*) > 2'),
  ('sql-subquery-students-with-a', 1, 'Find the student_ids with an A first, then match them to student names.'),
  ('sql-subquery-students-with-a', 2, 'WHERE s.id IN (SELECT student_id FROM enrollments WHERE grade = ''A'')')
) as h(problem_slug, level, content) on h.problem_slug = p.slug;

insert into problem_starter_code (problem_id, language_id, starter_code)
select p.id, (select id from languages where slug = 'sql'), 'SELECT' || chr(10) || '    -- your columns' || chr(10) || 'FROM' || chr(10) || '    -- your tables' || chr(10) || ';'
from problems p
where p.slug in (
  'sql-select-where','sql-count-group-by','sql-avg-salary-by-department','sql-having-filter','sql-subquery-above-average','sql-join-having-sum',
  'sql-inner-join-basic','sql-count-enrollment-per-course','sql-having-min-enrollment','sql-subquery-students-with-a'
);

-- ---------------------------------------------------------------------
-- Projects (Prompt 4: project-readiness foundation — see
-- db/schema/008_projects.sql's header comment: "the data shape projects
-- need to exist and be *recommended*." Full project submission/review UI
-- is a later prompt; these two exist so getProjectReadiness() has real
-- required_skills to evaluate against.
-- ---------------------------------------------------------------------

insert into projects (slug, title, description, difficulty, required_skills, is_published)
values
  (
    'number-cruncher-cli',
    'Number Cruncher CLI',
    'A small command-line tool that reads a list of numbers and reports basic statistics (sum, average, min, max, even/odd split). Exercises the foundations: variables, operators, control flow, and arrays working together in one program instead of isolated problems.',
    'beginner',
    jsonb_build_array(
      jsonb_build_object('skill_id', (select id from skills where slug = 'variables'), 'min_mastery_score', 45),
      jsonb_build_object('skill_id', (select id from skills where slug = 'operators'), 'min_mastery_score', 45),
      jsonb_build_object('skill_id', (select id from skills where slug = 'control-flow'), 'min_mastery_score', 45),
      jsonb_build_object('skill_id', (select id from skills where slug = 'arrays'), 'min_mastery_score', 45)
    ),
    true
  ),
  (
    'student-records-dashboard',
    'Student Records SQL Dashboard',
    'A set of reporting queries over a small student/course/enrollment schema: per-department averages, per-course enrollment counts, and students above a grade threshold. Exercises SELECT/WHERE, aggregation, and joins together against a realistic multi-table schema.',
    'intermediate',
    jsonb_build_array(
      jsonb_build_object('skill_id', (select id from skills where slug = 'sql-select-where'), 'min_mastery_score', 50),
      jsonb_build_object('skill_id', (select id from skills where slug = 'sql-aggregation'), 'min_mastery_score', 55),
      jsonb_build_object('skill_id', (select id from skills where slug = 'sql-joins-subqueries'), 'min_mastery_score', 50)
    ),
    true
  );

insert into project_requirements (project_id, title, description, sort_order)
select p.id, r.title, r.description, r.sort_order
from projects p
join (values
  ('number-cruncher-cli', 'Read a list of numbers', 'Accept a list of integers from stdin (one program run, not one number at a time).', 1),
  ('number-cruncher-cli', 'Report sum, average, min, max', 'Print all four values in a clearly labeled format.', 2),
  ('number-cruncher-cli', 'Report the even/odd split', 'Print how many of the input numbers are even and how many are odd.', 3),
  ('student-records-dashboard', 'Per-department average salary/grade report', 'One query producing an aggregate per group.', 1),
  ('student-records-dashboard', 'Per-course enrollment counts', 'One query joining enrollments to courses and grouping.', 2),
  ('student-records-dashboard', 'Students above a threshold', 'One query using a subquery or HAVING to filter on an aggregate.', 3)
) as r(project_slug, title, description, sort_order) on r.project_slug = p.slug;

-- ---------------------------------------------------------------------
-- Prompt 7: project_skills / project_languages for the two projects
-- seeded above — see db/schema/020_project_engine.sql. Supersedes
-- required_skills jsonb (still present on the rows above, now unread) as
-- the real relational source getProjectReadiness() queries.
-- ---------------------------------------------------------------------

insert into project_skills (project_id, skill_id, relationship, min_mastery_score)
select p.id, s.id, 'prerequisite', r.min_mastery_score
from projects p
join (values
  ('number-cruncher-cli', 'variables', 45),
  ('number-cruncher-cli', 'operators', 45),
  ('number-cruncher-cli', 'control-flow', 45),
  ('number-cruncher-cli', 'arrays', 45),
  ('student-records-dashboard', 'sql-select-where', 50),
  ('student-records-dashboard', 'sql-aggregation', 55),
  ('student-records-dashboard', 'sql-joins-subqueries', 50)
) as r(project_slug, skill_slug, min_mastery_score) on r.project_slug = p.slug
join skills s on s.slug = r.skill_slug;

insert into project_languages (project_id, language_id)
select p.id, l.id
from projects p
join (values
  ('number-cruncher-cli', 'python'),
  ('number-cruncher-cli', 'c'),
  ('number-cruncher-cli', 'cpp'),
  ('number-cruncher-cli', 'java'),
  ('student-records-dashboard', 'sql')
) as r(project_slug, language_slug) on r.project_slug = p.slug
join languages l on l.slug = r.language_slug;

-- ---------------------------------------------------------------------
-- Prompt 7: project brief content + stages for the two seeded projects —
-- see db/schema/020_project_engine.sql's new projects.* columns and
-- project_stages table. Additive UPDATE (never touches the original
-- INSERT above) + new INSERTs.
-- ---------------------------------------------------------------------

update projects set
  overview = 'A command-line tool that reads a list of integers from standard input and reports summary statistics. This is the kind of small, self-contained utility that shows up constantly in real data-processing pipelines — reading raw input, validating it, and turning it into a clear report.',
  problem_statement = 'Your program reads a whitespace-separated list of integers from stdin (one program run, not one number at a time) and prints a labeled report: sum, average, minimum, maximum, and how many of the inputs are even vs. odd. The report format must be exact — this is graded by comparing your program''s stdout to an expected output, not by "close enough."',
  why_it_matters = 'Reading and validating input before doing anything else is the first thing almost every real program has to do correctly. Getting this right — handling the input cleanly, keeping the arithmetic correct, and producing exact, predictable output — is the same skill you need for log processors, ETL scripts, and CLI tools you''ll actually ship.',
  objectives = jsonb_build_array(
    'Read a whitespace-separated list of integers from stdin in a single pass.',
    'Compute sum, average, minimum, and maximum without a library that does it for you.',
    'Count how many inputs are even and how many are odd.',
    'Print all five values in the exact labeled format the grader expects.'
  ),
  constraints_list = jsonb_build_array(
    'The input list has between 1 and 1000 integers.',
    'Integers may be negative.',
    'Average must be printed with exactly 2 decimal places.'
  ),
  examples = jsonb_build_array(
    jsonb_build_object('input', '4 8 15 16 23 42', 'output', 'Sum: 108' || chr(10) || 'Average: 18.00' || chr(10) || 'Min: 4' || chr(10) || 'Max: 42' || chr(10) || 'Even: 4' || chr(10) || 'Odd: 2', 'explanation', 'Six numbers; 4 are even (4, 8, 16, 42), 2 are odd (15, 23).')
  ),
  starter_instructions = 'Start by reading all of stdin and splitting it into integers. Get the sum and average working and passing first (Stage 1) before adding min/max/even-odd (Stage 2) — the stages grade independently, so a working Stage 1 is real, banked progress even before Stage 2 passes.'
where slug = 'number-cruncher-cli';

update projects set
  overview = 'A set of SQL reporting queries over a small student/course/enrollment schema — the same shape of work as a real internal analytics dashboard: aggregate metrics, per-group breakdowns, and threshold filtering against real relational data.',
  problem_statement = 'You are given a schema with students, courses, and enrollments (grades included). Each stage asks for one specific report as a single SQL query, graded by running it against a real isolated dataset and comparing the result rows to the expected output — row order does not matter unless the stage says so.',
  why_it_matters = 'Almost every product with a database eventually needs "one query that answers a real business question" — average performance per group, counts per category, who''s above/below a threshold. These three patterns (GROUP BY aggregation, JOIN across tables, and filtering on an aggregate) cover the large majority of real reporting SQL you''ll write on the job.',
  objectives = jsonb_build_array(
    'Write a GROUP BY query producing one aggregate row per department.',
    'Join enrollments to courses and count enrollment per course.',
    'Filter groups on an aggregate condition using HAVING or a subquery.'
  ),
  constraints_list = jsonb_build_array(
    'Each stage is graded as a single SELECT statement.',
    'Do not hardcode department, course, or student names — the grader runs your query against data your program never sees in advance.'
  ),
  examples = '[]'::jsonb,
  starter_instructions = 'The dataset schema is shown below the fold once you start the project. Write one SELECT per stage; run it against the visible tests before submitting to catch column-naming or type mistakes early.'
where slug = 'student-records-dashboard';

insert into project_stages (project_id, slug, title, description, sort_order)
select p.id, s.slug, s.title, s.description, s.sort_order
from projects p
join (values
  ('number-cruncher-cli', 'sum-and-average', 'Sum and Average', 'Read the input list and print the sum and average, exactly matching the labeled format.', 1),
  ('number-cruncher-cli', 'full-report', 'Full Report', 'Extend the program to also report min, max, and the even/odd split.', 2),
  ('student-records-dashboard', 'department-averages', 'Department Averages', 'One query producing an average grade per department.', 1),
  ('student-records-dashboard', 'enrollment-and-filtering', 'Enrollment & Filtering', 'One query joining enrollments to courses and filtering on an aggregate threshold.', 2)
) as s(project_slug, slug, title, description, sort_order) on s.project_slug = p.slug;

insert into project_stage_requirements (stage_id, description, sort_order)
select st.id, r.description, r.sort_order
from project_stages st
join projects p on p.id = st.project_id
join (values
  ('number-cruncher-cli', 'sum-and-average', 'Print "Sum: <n>" on its own line.', 1),
  ('number-cruncher-cli', 'sum-and-average', 'Print "Average: <n.nn>" with exactly 2 decimal places.', 2),
  ('number-cruncher-cli', 'full-report', 'Print "Min: <n>" and "Max: <n>".', 1),
  ('number-cruncher-cli', 'full-report', 'Print "Even: <count>" and "Odd: <count>".', 2),
  ('student-records-dashboard', 'department-averages', 'Group by department; one row per department.', 1),
  ('student-records-dashboard', 'enrollment-and-filtering', 'Join enrollments to courses before counting.', 1),
  ('student-records-dashboard', 'enrollment-and-filtering', 'Filter using HAVING or a subquery on the aggregate, not a hardcoded value.', 2)
) as r(project_slug, stage_slug, description, sort_order) on r.project_slug = p.slug and r.stage_slug = st.slug;

-- ---------------------------------------------------------------------
-- Prompt 7: project_test_cases (+ project_sql_datasets for the SQL
-- stages) — see db/schema/020_project_engine.sql. Mirrors
-- problem_test_cases exactly so runJudge() grades these with zero new
-- execution code. SQL expected_output values were captured by actually
-- running the reference queries against the real isolated SQL sandbox
-- (services/execution/sql-sandbox.ts), not hand-computed — pg returns
-- NUMERIC/COUNT(*) as strings, e.g. '["Computer Science","80"]', not
-- bare numbers, and unordered_rows comparison depends on getting that
-- exactly right.
-- ---------------------------------------------------------------------

insert into project_test_cases (stage_id, input, expected_output, is_hidden, is_edge_case, sort_order, comparison_mode)
select st.id, tc.input, tc.expected_output, tc.is_hidden, tc.is_edge_case, tc.sort_order, 'trim'
from project_stages st
join projects p on p.id = st.project_id
join (values
  ('number-cruncher-cli', 'sum-and-average', '4 8 15 16 23 42', 'Sum: 108' || chr(10) || 'Average: 18.00', false, false, 1),
  ('number-cruncher-cli', 'sum-and-average', '1 2 3', 'Sum: 6' || chr(10) || 'Average: 2.00', false, false, 2),
  ('number-cruncher-cli', 'sum-and-average', '5', 'Sum: 5' || chr(10) || 'Average: 5.00', true, true, 3),
  ('number-cruncher-cli', 'sum-and-average', '-3 3', 'Sum: 0' || chr(10) || 'Average: 0.00', true, true, 4),

  ('number-cruncher-cli', 'full-report', '4 8 15 16 23 42', 'Sum: 108' || chr(10) || 'Average: 18.00' || chr(10) || 'Min: 4' || chr(10) || 'Max: 42' || chr(10) || 'Even: 4' || chr(10) || 'Odd: 2', false, false, 1),
  ('number-cruncher-cli', 'full-report', '1 2 3', 'Sum: 6' || chr(10) || 'Average: 2.00' || chr(10) || 'Min: 1' || chr(10) || 'Max: 3' || chr(10) || 'Even: 1' || chr(10) || 'Odd: 2', false, false, 2),
  ('number-cruncher-cli', 'full-report', '5', 'Sum: 5' || chr(10) || 'Average: 5.00' || chr(10) || 'Min: 5' || chr(10) || 'Max: 5' || chr(10) || 'Even: 0' || chr(10) || 'Odd: 1', true, true, 3),
  ('number-cruncher-cli', 'full-report', '-4 -2 0 2 4', 'Sum: 0' || chr(10) || 'Average: 0.00' || chr(10) || 'Min: -4' || chr(10) || 'Max: 4' || chr(10) || 'Even: 5' || chr(10) || 'Odd: 0', true, true, 4)
) as tc(project_slug, stage_slug, input, expected_output, is_hidden, is_edge_case, sort_order)
  on tc.project_slug = p.slug and tc.stage_slug = st.slug;

insert into project_test_cases (stage_id, input, expected_output, is_hidden, is_edge_case, sort_order, comparison_mode)
select st.id, '', tc.expected_output, tc.is_hidden, false, tc.sort_order, 'unordered_rows'
from project_stages st
join projects p on p.id = st.project_id
join (values
  ('student-records-dashboard', 'department-averages', '[["Computer Science","80"],["Mathematics","79"],["Physics","90"]]', false, 1),
  -- Both cases must agree with each other: a stage's SQL query runs once
  -- against the shared dataset (services/execution/judge.ts's judgeSql) and
  -- that one result is compared against every test case's expected_output,
  -- so a visible "unfiltered" expectation and a hidden "HAVING-filtered"
  -- expectation can never both be satisfiable by one query. Both cases
  -- here expect the correctly-filtered result — see PROJECT ENGINE FIX.
  ('student-records-dashboard', 'enrollment-and-filtering', '[["Algorithms","4"]]', false, 1),
  ('student-records-dashboard', 'enrollment-and-filtering', '[["Algorithms","4"]]', true, 2)
) as tc(project_slug, stage_slug, expected_output, is_hidden, sort_order)
  on tc.project_slug = p.slug and tc.stage_slug = st.slug;

insert into project_sql_datasets (stage_id, schema_sql, seed_sql)
select st.id,
  'create table students (id int primary key, name text not null, department text not null, year int not null);' || chr(10) ||
  'create table courses (id int primary key, title text not null, credits int not null);' || chr(10) ||
  'create table enrollments (id int primary key, student_id int references students(id), course_id int references courses(id), grade int not null);',
  'insert into students (id, name, department, year) values ' ||
  '(1,''Sam'',''Computer Science'',2),(2,''Lee'',''Mathematics'',3),(3,''Kai'',''Computer Science'',1),' ||
  '(4,''Nina'',''Physics'',2),(5,''Omar'',''Mathematics'',2),(6,''Priya'',''Physics'',3),(7,''Zara'',''Computer Science'',3);' || chr(10) ||
  'insert into courses (id, title, credits) values (1,''Algorithms'',4),(2,''Databases'',3),(3,''Calculus'',3),(4,''Physics I'',3);' || chr(10) ||
  'insert into enrollments (id, student_id, course_id, grade) values ' ||
  '(1,1,1,88),(2,1,2,82),(3,2,1,91),(4,2,3,77),(5,3,1,65),(6,4,2,95),(7,4,4,89),(8,5,3,70),(9,6,3,93),(10,6,4,81),(11,7,1,84);'
from project_stages st
join projects p on p.id = st.project_id
where p.slug = 'student-records-dashboard';

-- ---------------------------------------------------------------------
-- Prompt 7 fix: project_skills also needs 'demonstrates' rows — a
-- passing submission is real evidence the skill was applied, feeding
-- services/mastery/get-skill-evidence.ts's project-evidence path.
-- 'prerequisite' rows alone (added earlier) only gate readiness; without
-- 'demonstrates' rows, getSkillIdsDemonstratedByProject() returns
-- nothing and a passed project never updates skill_mastery at all.
-- ---------------------------------------------------------------------
insert into project_skills (project_id, skill_id, relationship, min_mastery_score)
select p.id, s.id, 'demonstrates', null
from projects p
join (values
  ('number-cruncher-cli', 'variables'),
  ('number-cruncher-cli', 'operators'),
  ('number-cruncher-cli', 'control-flow'),
  ('number-cruncher-cli', 'arrays'),
  ('student-records-dashboard', 'sql-select-where'),
  ('student-records-dashboard', 'sql-aggregation'),
  ('student-records-dashboard', 'sql-joins-subqueries')
) as r(project_slug, skill_slug) on r.project_slug = p.slug
join skills s on s.slug = r.skill_slug;
