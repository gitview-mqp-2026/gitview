import { Fragment } from "react";
import { Link } from "react-router-dom";
import "../App.css";

// crumbs: [{ label, to? }]. Every crumb with a `to` is a link; the last one is the current page.
function Breadcrumbs({ crumbs }) {
    return (
        <nav className="file-path" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => {
                const current = index === crumbs.length - 1;
                return (
                    <Fragment key={`${index}:${crumb.label}`}>
                        {index > 0 && <span className="crumb-separator" aria-hidden="true">/</span>}
                        {current || !crumb.to ? (
                            <strong aria-current={current ? "page" : undefined}>{crumb.label}</strong>
                        ) : (
                            <Link to={crumb.to}>{crumb.label}</Link>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}

export default Breadcrumbs;
