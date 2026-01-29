# Token Caching and Cost Optimization

Grok CLI automatically optimizes API costs through token caching when using API key authentication. This feature reuses previous system instructions and context to reduce the number of tokens processed in subsequent requests.

You can view your token usage and cached token savings using the `/stats` command. When cached tokens are available, they will be displayed in the stats output.
