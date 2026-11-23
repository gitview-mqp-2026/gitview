import { Fragment } from "react";
import { Link } from "react-router-dom";

// crumbs: [{ label, to?, title? }]. Every crumb with a `to` is a link; the last one is the current page.
function Breadcrumbs({ crumbs }) {
    return (
        <nav className="file-path" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => {
                const current = index === crumbs.length - 1;
                return (
                    <Fragment key={`${index}:${crumb.label}`}>
                        {index > 0 && <span className="crumb-separator" aria-hidden="true">/</span>}
                        {current || !crumb.to ? (
                            <strong aria-current={current ? "page" : undefined} title={crumb.title}>{crumb.label}</strong>
                        ) : (
                            <Link to={crumb.to} title={crumb.title}>{crumb.label}</Link>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}

export default Breadcrumbs;
