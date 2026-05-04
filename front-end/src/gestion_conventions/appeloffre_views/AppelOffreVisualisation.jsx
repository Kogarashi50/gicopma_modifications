import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Spinner, Alert, Badge, Button, Row, Col, Stack, Card, Popover, OverlayTrigger } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faToggleOn, faToggleOff, faInfoCircle, faCalendarAlt, faMoneyBillWave,
    faUsers, faUserTie, faPaperclip, faFilePdf,
    faFileWord, faFileExcel, faFileImage, faFileAlt, faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import '../conventions_views/visualisation.css';

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const datePart = String(dateString).split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return dateString;
    return new Date(datePart + 'T00:00:00Z').toLocaleDateString('fr-FR');
};

const formatCurrency = (value) => {
    if (value == null || isNaN(Number(value))) return '-';
    return parseFloat(value).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' });
};

const displayData = (data, fallback = '-') => data ?? fallback;

const renderBooleanStatus = (value) => (
    value
        ? <Badge bg="success" text="white"><FontAwesomeIcon icon={faToggleOn} className="me-1" /> Oui</Badge>
        : <Badge bg="secondary" text="white"><FontAwesomeIcon icon={faToggleOff} className="me-1" /> Non</Badge>
);

const getFileIcon = (filename) => {
    if (!filename) return faFileAlt;
    const lowerCase = String(filename).toLowerCase();
    if (lowerCase.endsWith('.pdf')) return faFilePdf;
    if (lowerCase.endsWith('.doc') || lowerCase.endsWith('.docx')) return faFileWord;
    if (lowerCase.endsWith('.xls') || lowerCase.endsWith('.xlsx')) return faFileExcel;
    if (['.jpg', '.jpeg', '.png', '.gif'].some(ext => lowerCase.endsWith(ext))) return faFileImage;
    return faFileAlt;
};

const CARD_CLASS = "h-100 border-0 shadow-sm card-visual";
const CARD_HEADER_CLASS = "bg-gradient-yellow";
const CARD_TITLE_CLASS = "mb-0 fw-bold text-dark d-flex align-items-center";
const CARD_ACCENT_STYLE = { borderLeft: "4px solid #ffc107" };
const CARD_BODY_STYLE = { backgroundColor: "#fefefe" };
const DL_CLASS = "row mb-0 dl-compact";
const DT_CLASS = "col-sm-4 text-muted fw-semibold";
const DD_CLASS = "col-sm-8 text-dark";

const AppelOffreVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [appelOffreData, setAppelOffreData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fonctionnairesList, setFonctionnairesList] = useState([]);
    const [provinceOptions, setProvinceOptions] = useState([]);

    const fetchData = useCallback(async () => {
        if (!itemId) {
            setError("ID manquant.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [aoRes, foncRes, provRes] = await Promise.all([
                axios.get(`${baseApiUrl}/appel-offres/${itemId}`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/options/fonctionnaires`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/options/provinces`, { withCredentials: true }),
            ]);

            setAppelOffreData(aoRes.data);
            setFonctionnairesList(foncRes.data.fonctionnaires || foncRes.data || []);
            setProvinceOptions(provRes.data.provinces || provRes.data || []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    }, [itemId, baseApiUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fonctionnaireMap = useMemo(
        () => new Map(fonctionnairesList.map(f => [String(f.id), f.nom_complet])),
        [fonctionnairesList]
    );

    const provinceMap = useMemo(
        () => new Map(provinceOptions.map(p => [String(p.value ?? p.Id ?? p.id), p.label ?? p.Description ?? p.Nom])),
        [provinceOptions]
    );

    const getFonctionnaireNames = useCallback((fonctionnaireIdString) => {
        if (!fonctionnaireIdString) return '-';
        const ids = String(fonctionnaireIdString).split(';').map(id => id.trim()).filter(Boolean);
        if (!ids.length) return '-';

        return (
            <Stack direction="horizontal" gap={1} className="flex-wrap">
                {ids.map(id => (
                    <Badge key={id} pill bg="info" text="dark" className="border me-1 mb-1">
                        <FontAwesomeIcon icon={faUserTie} className="me-1" />
                        {fonctionnaireMap.get(id) || `ID ${id}`}
                    </Badge>
                ))}
            </Stack>
        );
    }, [fonctionnaireMap]);

    const renderProvinceBadges = useCallback((provinces) => {
        if (!Array.isArray(provinces) || !provinces.length) return '-';

        return (
            <Stack direction="horizontal" gap={1} className="flex-wrap">
                {provinces.map((province, index) => {
                    const label = provinceMap.get(String(province)) || province;
                    return <Badge key={`${province}-${index}`} pill bg="light" text="dark" className="border me-1 mb-1">{label}</Badge>;
                })}
            </Stack>
        );
    }, [provinceMap]);

    const filePopover = (file) => (
        <Popover id={`popover-file-${file.id}`} style={{ maxWidth: '350px' }}>
            <Popover.Header as="h3" className="small fw-bold">{displayData(file.intitule, "Details du fichier")}</Popover.Header>
            <Popover.Body>
                <p className="small mb-1"><strong>Fichier original:</strong> <span className="text-muted">{displayData(file.nom_fichier)}</span></p>
                <p className="small mb-0"><strong>Categorie:</strong> <Badge bg="secondary" pill>{displayData(file.categorie?.label, 'Non classe')}</Badge></p>
            </Popover.Body>
        </Popover>
    );

    if (loading) {
        return (
            <div className="text-center p-5 d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
                <Spinner animation="border" variant="primary" className="me-3" />
                <span className="text-muted">Chargement...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger" className="m-3 m-md-4">
                <Alert.Heading><FontAwesomeIcon icon={faInfoCircle} className="me-2" /> Erreur</Alert.Heading>
                <p>{error}</p>
                <hr />
                {onClose && <Button onClick={onClose} variant="outline-danger" size="sm">Fermer</Button>}
            </Alert>
        );
    }

    if (!appelOffreData) {
        return <Alert variant="secondary" className="m-3 m-md-4">Aucune donnee disponible.</Alert>;
    }

    return (
        <div
            className="p-3 p-md-4 convention-visualisation-container bg-light"
            style={{ borderRadius: "15px", maxHeight: "90vh", overflowY: "auto", fontSize: "15px" }}
        >
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-2">
                <h3 className="mb-0 fw-bold text-dark">Details Appel d'Offre: {displayData(appelOffreData.numero)}</h3>
                {onClose && (
                    <Button variant="warning" onClick={onClose} className="btn rounded-5 px-5 fw-bold py-1 bg-warning shadow-sm">
                        Revenir a la liste
                    </Button>
                )}
            </div>

            <Row className="g-4 mb-4">
                <Col md={6} lg={7}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faInfoCircle} className="me-2 text-warning" />
                                INFORMATIONS GENERALES
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Numero:</dt><dd className={`${DD_CLASS} fw-bold`}>{displayData(appelOffreData.numero)}</dd>
                                <dt className={DT_CLASS}>Intitule:</dt><dd className={DD_CLASS}>{displayData(appelOffreData.intitule)}</dd>
                                <dt className={DT_CLASS}>Categorie:</dt><dd className={DD_CLASS}><Badge bg="info" text="dark" className="px-2 py-1">{displayData(appelOffreData.categorie)}</Badge></dd>
                                <dt className={DT_CLASS}>Province(s):</dt><dd className={DD_CLASS}>{renderProvinceBadges(appelOffreData.provinces)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={5}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faMoneyBillWave} className="me-2 text-warning" />
                                FINANCEMENT
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Estimation TTC:</dt><dd className={`${DD_CLASS} fw-bold`}>{formatCurrency(appelOffreData.estimation)}</dd>
                                <dt className={DT_CLASS}>Estimation HT:</dt><dd className={DD_CLASS}>{formatCurrency(appelOffreData.estimation_HT)}</dd>
                                <dt className={DT_CLASS}>Montant TVA:</dt><dd className={DD_CLASS}>{formatCurrency(appelOffreData.montant_TVA)}</dd>
                                <dt className={DT_CLASS}>Duree execution:</dt><dd className={DD_CLASS}><Badge bg="warning" text="dark">{displayData(appelOffreData.duree_execution)} jours</Badge></dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={7}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faCalendarAlt} className="me-2 text-warning" />
                                DATES IMPORTANTES
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Date publication:</dt><dd className={DD_CLASS}>{formatDate(appelOffreData.date_publication)}</dd>
                                <dt className={DT_CLASS}>Date verification:</dt><dd className={DD_CLASS}>{formatDate(appelOffreData.date_verification)}</dd>
                                <dt className={DT_CLASS}>Date ouverture plis:</dt><dd className={DD_CLASS}>{formatDate(appelOffreData.date_ouverture)}</dd>
                                <dt className={DT_CLASS}>Derniere session OP:</dt><dd className={DD_CLASS}>{formatDate(appelOffreData.last_session_op)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={5}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faUsers} className="me-2 text-warning" />
                                STATUT & POINTS FOCAUX
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Lance sur portail:</dt><dd className={DD_CLASS}>{renderBooleanStatus(appelOffreData.lancement_portail)}</dd>
                                {appelOffreData.lancement_portail && (
                                    <>
                                        <dt className={DT_CLASS}>Date lancement:</dt><dd className={DD_CLASS}>{formatDate(appelOffreData.date_lancement_portail)}</dd>
                                    </>
                                )}
                                <dt className={DT_CLASS}>Points focaux:</dt><dd className={DD_CLASS}>{getFonctionnaireNames(appelOffreData.id_fonctionnaire)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col xs={12}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faPaperclip} className="me-2 text-warning" />
                                PIECES JOINTES
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            {appelOffreData.fichiers?.length > 0 ? (
                                <div className="d-flex flex-wrap" style={{ gap: '0.75rem' }}>
                                    {appelOffreData.fichiers.map(file => (
                                        <OverlayTrigger trigger={['hover', 'focus']} placement="top" overlay={filePopover(file)} key={file.id}>
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                                                <div className="border rounded p-2 d-flex align-items-center bg-dark text-white shadow-sm" style={{ minWidth: '220px', cursor: 'pointer' }}>
                                                    <FontAwesomeIcon icon={getFileIcon(file.nom_fichier)} className="me-2 fa-lg text-warning" />
                                                    <span className="me-auto small text-truncate" title={file.intitule}>{displayData(file.intitule, 'Fichier')}</span>
                                                    {file.url && <FontAwesomeIcon icon={faExternalLinkAlt} size="xs" className="ms-2" />}
                                                </div>
                                            </a>
                                        </OverlayTrigger>
                                    ))}
                                </div>
                            ) : (
                                <Alert variant="secondary" className="small py-2 mb-0">
                                    <FontAwesomeIcon icon={faInfoCircle} className="me-2" /> Aucune piece jointe.
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

AppelOffreVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func,
    baseApiUrl: PropTypes.string.isRequired,
};

export default AppelOffreVisualisation;
