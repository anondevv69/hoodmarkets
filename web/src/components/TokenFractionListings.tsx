import { useCallback, useEffect, useState } from 'react';
import { zeroAddress, type Address } from 'viem';
import { txUrl, shortenAddress } from '../chain';
import { openWalletProfile } from '../lib/deployerProfileRoute';
import {
  buyFractionListing,
  cancelFractionListing,
  fetchFractionListings,
  formatListingPrice,
  type FractionListing,
} from '../lib/tokenFractions';

type WalletLike = {
  address: string;
  getEthereumProvider: () => Promise<unknown>;
};

export function TokenFractionListings({
  collectionAddress,
  wallet,
  onRefresh,
}: {
  collectionAddress: Address;
  wallet: WalletLike | null;
  onRefresh: () => Promise<void>;
}) {
  const [listings, setListings] = useState<FractionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [txById, setTxById] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refreshListings = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFractionListings(collectionAddress);
      setListings(rows);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [collectionAddress]);

  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  async function onBuy(listing: FractionListing) {
    if (!wallet) {
      setError('Connect a wallet to buy shares.');
      return;
    }
    if (listing.paymentToken.toLowerCase() !== zeroAddress) {
      setError('Only ETH listings are supported in the app right now.');
      return;
    }
    setError(null);
    setBusyId(listing.id);
    try {
      const provider = await wallet.getEthereumProvider();
      const hash = await buyFractionListing(
        collectionAddress,
        wallet.address as Address,
        listing.id,
        listing.priceWei,
        listing.paymentToken,
        provider,
      );
      setTxById((prev) => ({ ...prev, [listing.id]: hash }));
      await refreshListings();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buy failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(listing: FractionListing) {
    if (!wallet) return;
    setError(null);
    setBusyId(listing.id);
    try {
      const provider = await wallet.getEthereumProvider();
      const hash = await cancelFractionListing(
        collectionAddress,
        wallet.address as Address,
        listing.id,
        provider,
      );
      setTxById((prev) => ({ ...prev, [listing.id]: hash }));
      await refreshListings();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="token-fraction-listings">
      <p className="token-fraction-manage-title">Shares for sale</p>
      {loading ? (
        <p className="muted">Loading listings…</p>
      ) : listings.length === 0 ? (
        <p className="muted">No active listings.</p>
      ) : (
        <div className="token-fraction-table-wrap token-fraction-table-wrap--scroll">
          <table className="token-fraction-table">
            <thead>
              <tr>
                <th scope="col">Seller</th>
                <th scope="col">Shares</th>
                <th scope="col">Price</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const isSeller =
                  wallet && listing.seller.toLowerCase() === wallet.address.toLowerCase();
                const tx = txById[listing.id];
                return (
                  <tr key={listing.id}>
                    <td>
                      <button
                        type="button"
                        className="token-fraction-holder lp-mono"
                        onClick={() => openWalletProfile(listing.seller)}
                      >
                        {shortenAddress(listing.seller)}
                      </button>
                    </td>
                    <td>{listing.shareAmount.toLocaleString()}</td>
                    <td>{formatListingPrice(listing.paymentToken, listing.priceWei)}</td>
                    <td className="token-fraction-listing-actions">
                      {isSeller ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === listing.id}
                          onClick={() => void onCancel(listing)}
                        >
                          {busyId === listing.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === listing.id || !wallet}
                          onClick={() => void onBuy(listing)}
                        >
                          {busyId === listing.id ? 'Buying…' : 'Buy'}
                        </button>
                      )}
                      {tx ? (
                        <a
                          className="mono token-fraction-listing-tx"
                          href={txUrl(tx)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {tx.slice(0, 8)}…
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
