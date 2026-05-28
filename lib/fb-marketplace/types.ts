export type FbListing = {
  id: string;
  title: string | null;
  price: number;
  currency: string;
  location: string;
  url: string;
  images: string[];
  seller: { id: string; name: string };
  postedAt: string;
};

export type FbSearchOptions = {
  query: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
};

export type FbSearchResult =
  | {
      ok: true;
      listings: FbListing[];
    }
  | {
      ok: false;
      error: string;
    };
