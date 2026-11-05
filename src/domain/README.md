# Domain

Pure logic with no I/O: grant periods, order states, prices. Routes and screens call into it;
it never imports from `worker/`, `client/` or `db/`. Every rule here has reference cases or
properties (docs/testing.md), and mutation testing runs over this folder from slice 02.
