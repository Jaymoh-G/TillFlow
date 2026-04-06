import { Link } from 'react-router-dom';

/**
 * Shown inside TillFlow admin when the browser is offline and the current route
 * is not one of the offline-capable sales / quoting routes.
 */
export default function AdminOfflineWait() {
  return (
    <div className="tf-offline-wait">
      <div className="tf-offline-wait__card">
        <h2 className="tf-offline-wait__title">You&apos;re offline</h2>
        <p className="tf-offline-wait__text">
          This section needs an internet connection. You can keep working in{' '}
          <strong>POS orders</strong>, <strong>online orders</strong>, <strong>quotations</strong>,{' '}
          <strong>sales returns</strong>, and the <strong>POS register</strong> while offline; changes can sync when
          you&apos;re back online. Invoicing will join this list once that module is implemented.
        </p>
        <ul className="tf-offline-wait__links">
          <li>
            <Link to="/tillflow/admin/pos-orders">POS orders</Link>
          </li>
          <li>
            <Link to="/tillflow/admin/online-orders">Online orders</Link>
          </li>
          <li>
            <Link to="/tillflow/admin/quotations">Quotations</Link>
          </li>
          <li>
            <Link to="/tillflow/admin/sales-returns">Sales returns</Link>
          </li>
          <li>
            <Link to="/tillflow/pos">POS register</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
