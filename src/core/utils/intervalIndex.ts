/*
 * Chunked interval directory for the timeline's one-dimensional time axis.
 *
 * The index deliberately is not a tree: timeline edits are usually local, and
 * a sorted set of small typed-array blocks gives the same query locality while
 * keeping inserts/removals from copying every interval in the line.
 */

import { lowerBound, upperBound } from "./search.ts";

/** A time span as the directory returns it: the payload plus its start/end. */
export interface IntervalEntry<T> {
  item: T;
  index: number;
  start: number;
  end: number;
}

interface IntervalBlock {
  indices: Uint32Array;
  starts: Float64Array;
  ends: Float64Array;
  maxEnd: number;
}

const BLOCK_SIZE = 256;

/**
 * Chunked interval directory over an immutable item array.
 *
 * Items are indexed by start time into sorted typed-array blocks; queries return
 * entries that overlap an inclusive time range. The source array identity drives
 * incremental replacement, so callers must treat items as immutable.
 */
export class IntervalIndex<T> {
  /** Source items in caller order; indices in query results point here. */
  declare items: readonly T[];
  /** Number of source items, exposed without leaking the directory layout. */
  get size(): number {
    return this.items.length;
  }

  /** Number of full sort/build passes; useful for smoke tests and profiling. */
  rebuildCount = 1;
  /** Number of array-identity changes handled without a full sort. */
  incrementalUpdateCount = 0;

  private readonly startOf: (item: T) => number;
  private readonly endOf: (item: T) => number;
  private blocks: IntervalBlock[] = [];
  /** First start in each block, used to find the query's right boundary. */
  private blockFirstStarts = new Float64Array(0);
  /** Prefix maximum of block end values, used to skip expired blocks. */
  private prefixMaxEnds = new Float64Array(0);

  /**
   * Build the directory for an initial item array.
   *
   * `start` and `end` must return finite values for every item and are retained
   * for later incremental updates.
   */
  constructor(items: readonly T[], start: (item: T) => number, end: (item: T) => number) {
    this.startOf = start;
    this.endOf = end;
    this.items = items;
    this.assignBlocks(this.sortedEntries(items));
  }

  /**
   * Replace the source array, reusing the sorted directory for appends, stable
   * deletions, and small in-place replacements.
   *
   * Returns how the directory was updated: unchanged, incremental, or rebuilt.
   */
  replaceItems(items: readonly T[]): "same" | "incremental" | "rebuilt" {
    if (items === this.items) {
      return "same";
    }
    const previous = this.items;
    const changed: number[] = [];
    const commonLength = Math.min(previous.length, items.length);
    for (let index = 0; index < commonLength; index++) {
      if (previous[index] !== items[index]) {
        changed.push(index);
      }
    }

    if (items.length >= previous.length && changed.length === 0) {
      this.items = items;
      for (let index = previous.length; index < items.length; index++) {
        this.insertEntry(index, items[index]);
      }
      this.incrementalUpdateCount++;
      this.rebuildDirectory();
      return "incremental";
    }

    if (
      previous.length === items.length &&
      changed.length > 0 &&
      changed.length <= Math.max(8, Math.ceil(items.length / 64))
    ) {
      this.items = items;
      for (const index of changed) {
        this.removeEntry(index);
      }
      for (const index of changed) {
        this.insertEntry(index, items[index]);
      }
      this.incrementalUpdateCount++;
      this.rebuildDirectory();
      return "incremental";
    }

    const previousByItem = new Map<T, number>();
    for (let index = 0; index < previous.length; index++) {
      previousByItem.set(previous[index], index);
    }
    if (this.isStableDeletion(items, previousByItem, previous.length - items.length)) {
      this.items = items;
      const nextIndex = new Map<T, number>();
      for (let index = 0; index < items.length; index++) {
        nextIndex.set(items[index], index);
      }

      // Existing blocks are already sorted. Re-index their payloads without
      // sorting or allocating a second full-size typed-array directory.
      const nextEntries: Array<{ index: number; start: number; end: number }> = [];
      for (const block of this.blocks) {
        for (let position = 0; position < block.indices.length; position++) {
          const item = previous[block.indices[position]];
          const index = nextIndex.get(item);
          if (index !== undefined) {
            nextEntries.push({
              index,
              start: block.starts[position],
              end: block.ends[position],
            });
          }
        }
      }
      this.assignBlocks(nextEntries);
      this.incrementalUpdateCount++;
      return "incremental";
    }

    this.items = items;
    this.assignBlocks(this.sortedEntries(items));
    this.rebuildCount++;
    return "rebuilt";
  }

  /** Return every entry overlapping the inclusive range `[start, end]`. */
  query(start: number, end: number): IntervalEntry<T>[] {
    const result: IntervalEntry<T>[] = [];
    if (start > end) {
      return result;
    }
    const [firstBlock, lastBlock] = this.queryBlockRange(start, end);
    if (firstBlock > lastBlock) {
      return result;
    }
    for (let blockIndex = firstBlock; blockIndex <= lastBlock; blockIndex++) {
      const block = this.blocks[blockIndex];
      if (block.maxEnd < start) {
        continue;
      }
      const limit = upperBound(block.starts, end);
      for (let position = 0; position < limit; position++) {
        if (block.ends[position] < start) {
          continue;
        }
        const index = block.indices[position];
        result.push({
          item: this.items[index],
          index,
          start: block.starts[position],
          end: block.ends[position],
        });
      }
    }
    return result;
  }

  /** Return only the overlapping items, in directory order. */
  queryItems(start: number, end: number): T[] {
    const result: T[] = [];
    this.queryItemsInto(start, end, result);
    return result;
  }

  /** Fill a caller-owned result array to avoid per-frame query allocations. */
  queryItemsInto(start: number, end: number, result: T[]): T[] {
    result.length = 0;
    if (start > end) {
      return result;
    }
    const [firstBlock, lastBlock] = this.queryBlockRange(start, end);
    if (firstBlock > lastBlock) {
      return result;
    }
    for (let blockIndex = firstBlock; blockIndex <= lastBlock; blockIndex++) {
      const block = this.blocks[blockIndex];
      if (block.maxEnd < start) {
        continue;
      }
      const limit = upperBound(block.starts, end);
      for (let position = 0; position < limit; position++) {
        if (block.ends[position] >= start) {
          result.push(this.items[block.indices[position]]);
        }
      }
    }
    return result;
  }

  /** Report whether any entry overlaps the inclusive range. */
  has(start: number, end: number): boolean {
    if (start > end) {
      return false;
    }
    const [firstBlock, lastBlock] = this.queryBlockRange(start, end);
    for (let blockIndex = firstBlock; blockIndex <= lastBlock; blockIndex++) {
      const block = this.blocks[blockIndex];
      if (block.maxEnd < start) {
        continue;
      }
      const limit = upperBound(block.starts, end);
      for (let position = 0; position < limit; position++) {
        if (block.ends[position] >= start) {
          return true;
        }
      }
    }
    return false;
  }

  /** Restrict the block scan to blocks whose starts and ends can overlap the query. */
  private queryBlockRange(start: number, end: number): [number, number] {
    const firstBlock = lowerBound(this.prefixMaxEnds, start);
    const lastBlock = upperBound(this.blockFirstStarts, end) - 1;
    return [firstBlock, lastBlock];
  }

  /** Project items to index/start/end records sorted by start. */
  private sortedEntries(items: readonly T[]): Array<{ index: number; start: number; end: number }> {
    return items
      .map((item, index) => ({ index, start: this.startOf(item), end: this.endOf(item) }))
      .sort((a, b) => a.start - b.start);
  }

  /** Split sorted entries into fixed-size blocks and refresh the lookup directory. */
  private assignBlocks(entries: readonly { index: number; start: number; end: number }[]): void {
    this.blocks = [];
    for (let offset = 0; offset < entries.length; offset += BLOCK_SIZE) {
      this.blocks.push(this.createBlock(entries.slice(offset, offset + BLOCK_SIZE)));
    }
    this.rebuildDirectory();
  }

  /** Copy sorted records into typed arrays and record the block's maximum end. */
  private createBlock(
    entries: readonly { index: number; start: number; end: number }[],
  ): IntervalBlock {
    const indices = new Uint32Array(entries.length);
    const starts = new Float64Array(entries.length);
    const ends = new Float64Array(entries.length);
    let maxEnd = -Infinity;
    for (let position = 0; position < entries.length; position++) {
      const entry = entries[position];
      indices[position] = entry.index;
      starts[position] = entry.start;
      ends[position] = entry.end;
      maxEnd = Math.max(maxEnd, entry.end);
    }
    return { indices, starts, ends, maxEnd };
  }

  /** Recompute per-block first starts and the prefix maximum of block ends. */
  private rebuildDirectory(): void {
    this.blockFirstStarts = new Float64Array(this.blocks.length);
    this.prefixMaxEnds = new Float64Array(this.blocks.length);
    let maximum = -Infinity;
    for (let index = 0; index < this.blocks.length; index++) {
      const block = this.blocks[index];
      this.blockFirstStarts[index] = block.starts[0];
      maximum = Math.max(maximum, block.maxEnd);
      this.prefixMaxEnds[index] = maximum;
    }
  }

  /** Check that `items` is `this.items` with a non-empty suffix removed in order. */
  private isStableDeletion(
    items: readonly T[],
    previousByItem: Map<T, number>,
    removedCount: number,
  ): boolean {
    if (removedCount <= 0 || removedCount >= this.items.length) {
      return false;
    }
    let previousIndex = -1;
    for (const item of items) {
      const index = previousByItem.get(item);
      if (index === undefined || index <= previousIndex) {
        return false;
      }
      previousIndex = index;
    }
    return true;
  }

  /** Insert one entry into the block whose start range contains it, splitting when full. */
  private insertEntry(index: number, item: T): void {
    const start = this.startOf(item);
    const end = this.endOf(item);
    if (this.blocks.length === 0) {
      this.blocks.push(this.createBlock([{ index, start, end }]));
      this.rebuildDirectory();
      return;
    }
    const blockIndex = Math.max(0, upperBound(this.blockFirstStarts, start) - 1);
    const block = this.blocks[blockIndex];
    const position = upperBound(block.starts, start);
    const next = this.insertIntoBlock(block, position, index, start, end);
    if (next.indices.length <= BLOCK_SIZE) {
      this.blocks[blockIndex] = next;
      this.rebuildDirectory();
      return;
    }

    const split = Math.ceil(next.indices.length / 2);
    this.blocks.splice(
      blockIndex,
      1,
      this.sliceBlock(next, 0, split),
      this.sliceBlock(next, split, next.indices.length),
    );
    this.rebuildDirectory();
  }

  /** Return a copy of the block with one record inserted at `position`. */
  private insertIntoBlock(
    block: IntervalBlock,
    position: number,
    index: number,
    start: number,
    end: number,
  ): IntervalBlock {
    const indices = new Uint32Array(block.indices.length + 1);
    const starts = new Float64Array(block.starts.length + 1);
    const ends = new Float64Array(block.ends.length + 1);
    indices.set(block.indices.subarray(0, position));
    indices[position] = index;
    indices.set(block.indices.subarray(position), position + 1);
    starts.set(block.starts.subarray(0, position));
    starts[position] = start;
    starts.set(block.starts.subarray(position), position + 1);
    ends.set(block.ends.subarray(0, position));
    ends[position] = end;
    ends.set(block.ends.subarray(position), position + 1);
    return this.createBlockFromArrays(indices, starts, ends);
  }

  /** Remove one source index and merge under-full neighbors. */
  private removeEntry(index: number): void {
    const location = this.findEntry(index);
    if (!location) {
      return;
    }
    const [blockIndex, position] = location;
    const block = this.blocks[blockIndex];
    if (block.indices.length === 1) {
      this.blocks.splice(blockIndex, 1);
      this.rebuildDirectory();
      return;
    }
    this.blocks[blockIndex] = this.removeFromBlock(block, position);

    // Keep blocks reasonably dense after repeated deletes, while never
    // touching unrelated blocks. This bounds directory size and cache misses.
    if (
      blockIndex > 0 &&
      this.blocks[blockIndex - 1].indices.length + this.blocks[blockIndex].indices.length <=
        BLOCK_SIZE
    ) {
      this.blocks.splice(
        blockIndex - 1,
        2,
        this.mergeBlocks(this.blocks[blockIndex - 1], this.blocks[blockIndex]),
      );
    } else if (
      blockIndex + 1 < this.blocks.length &&
      this.blocks[blockIndex].indices.length + this.blocks[blockIndex + 1].indices.length <=
        BLOCK_SIZE
    ) {
      this.blocks.splice(
        blockIndex,
        2,
        this.mergeBlocks(this.blocks[blockIndex], this.blocks[blockIndex + 1]),
      );
    }
    this.rebuildDirectory();
  }

  /** Locate a source index in the directory. */
  private findEntry(index: number): [number, number] | undefined {
    for (let blockIndex = 0; blockIndex < this.blocks.length; blockIndex++) {
      const indices = this.blocks[blockIndex].indices;
      for (let position = 0; position < indices.length; position++) {
        if (indices[position] === index) {
          return [blockIndex, position];
        }
      }
    }
    return undefined;
  }

  /** Return a copy of the block without the record at `position`. */
  private removeFromBlock(block: IntervalBlock, position: number): IntervalBlock {
    const indices = new Uint32Array(block.indices.length - 1);
    const starts = new Float64Array(block.starts.length - 1);
    const ends = new Float64Array(block.ends.length - 1);
    indices.set(block.indices.subarray(0, position));
    indices.set(block.indices.subarray(position + 1), position);
    starts.set(block.starts.subarray(0, position));
    starts.set(block.starts.subarray(position + 1), position);
    ends.set(block.ends.subarray(0, position));
    ends.set(block.ends.subarray(position + 1), position);
    return this.createBlockFromArrays(indices, starts, ends);
  }

  /** Concatenate two sorted blocks into one block. */
  private mergeBlocks(left: IntervalBlock, right: IntervalBlock): IntervalBlock {
    const indices = new Uint32Array(left.indices.length + right.indices.length);
    const starts = new Float64Array(left.starts.length + right.starts.length);
    const ends = new Float64Array(left.ends.length + right.ends.length);
    indices.set(left.indices);
    indices.set(right.indices, left.indices.length);
    starts.set(left.starts);
    starts.set(right.starts, left.starts.length);
    ends.set(left.ends);
    ends.set(right.ends, left.ends.length);
    return this.createBlockFromArrays(indices, starts, ends);
  }

  /** Take one block's record slice as a new block. */
  private sliceBlock(block: IntervalBlock, start: number, end: number): IntervalBlock {
    return this.createBlockFromArrays(
      block.indices.slice(start, end),
      block.starts.slice(start, end),
      block.ends.slice(start, end),
    );
  }

  /** Wrap existing arrays as a block and compute its maximum end. */
  private createBlockFromArrays(
    indices: Uint32Array,
    starts: Float64Array,
    ends: Float64Array,
  ): IntervalBlock {
    let maxEnd = -Infinity;
    for (const end of ends) {
      maxEnd = Math.max(maxEnd, end);
    }
    return { indices, starts, ends, maxEnd };
  }
}
