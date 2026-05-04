// src/pages/sousprojets_views/SousProjetVisualisation.jsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faExclamationTriangle,
    faUserTie,
    faInfoCircle,
    faMapMarkerAlt,
    faTasks,
    faPiggyBank,
    faCommentDots,
    faClock,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Card, Row, Col, Alert, Spinner, Stack, Badge } from 'react-bootstrap';
import '../conventions_views/visualisation.css';

const formatPercentage = (value) => {
    const n = parseFloat(value);
    return isNaN(n) ? '-' : `${n.toFixed(2)} %`;
};

const formatNumber = (value, decimals = 2) => {
    const n = parseFloat(value);
    return isNaN(n)
        ? '-'
        : n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const displayData = (data, fallback = '-') => data ?? fallback;

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        return dateString;
    }
};

const normalizeIds = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            // Keep supporting legacy semicolon/comma separated values below.
        }

        return trimmed.split(/[;,]/).map(id => id.trim()).filter(Boolean);
    }

    return [value];
};

const VISUALISATION_CONTAINER_CLASS = "p-3 p-md-4 convention-visualisation-container bg-light";
const VISUALISATION_CLOSE_BUTTON_CLASS = "btn rounded-5 px-5 fw-bold py-1 bg-warning shadow-sm";
const CARD_CLASS = "h-100 border-0 shadow-sm card-visual";
const CARD_HEADER_CLASS = "bg-gradient-yellow";
const CARD_TITLE_CLASS = "mb-0 fw-bold text-dark d-flex align-items-center";
const DL_CLASS = "row mb-0 dl-compact";
const DT_CLASS = "col-sm-4 text-muted fw-semibold";
const DD_CLASS = "col-sm-8 text-dark";
const CARD_ACCENT_STYLE = { borderLeft: "4px solid #ffc107" };
const CARD_BODY_STYLE = { backgroundColor: "#fefefe" };

const SousProjetVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [sousProjetData, setSousProjetData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lookupData, setLookupData] = useState({
        provinces: [],
        communes: [],
        fonctionnaires: [],
    });

    const fetchData = useCallback(async () => {
        if (!itemId || !baseApiUrl) {
            setError("Configuration error: Missing ID or Base URL.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [sousProjetRes, provincesRes, communesRes, foncRes] = await Promise.all([
                axios.get(`${baseApiUrl}/sousprojets/${itemId}`),
                axios.get(`${baseApiUrl}/options/provinces`),
                axios.get(`${baseApiUrl}/options/communes`),
                axios.get(`${baseApiUrl}/options/fonctionnaires`),
            ]);

            const spData = sousProjetRes.data.sousprojet || sousProjetRes.data.sous_projet || sousProjetRes.data;
            if (!spData || typeof spData !== 'object' || !spData.Code_Sous_Projet) {
                throw new Error(`Format de donnees invalide recu pour Sous-Projet ${itemId}.`);
            }

            setSousProjetData(spData);
            setLookupData({
                provinces: provincesRes.data.provinces || provincesRes.data || [],
                communes: communesRes.data.communes || communesRes.data || [],
                fonctionnaires: foncRes.data.fonctionnaires || foncRes.data || [],
            });
        } catch (err) {
            const errorDetail = err.response?.data?.message || err.message || 'Erreur de chargement.';
            console.error('Error during fetch:', err);
            setError(`Echec du chargement des donnees: ${errorDetail}`);
        } finally {
            setLoading(false);
        }
    }, [itemId, baseApiUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getFonctionnaireNames = useCallback((fonctionnaireIdString) => {
        if (!fonctionnaireIdString || !lookupData.fonctionnaires.length) {
            return displayData(null);
        }

        const ids = normalizeIds(fonctionnaireIdString);
        if (!ids.length) return displayData(null);

        return (
            <Stack direction="horizontal" gap={1} className="flex-wrap">
                {ids.map(id => {
                    const fonctionnaire = lookupData.fonctionnaires.find(f => String(f.id) === String(id) || String(f.value) === String(id));
                    return (
                        <Badge key={id} pill bg="info" text="dark" className="border me-1 mb-1">
                            <FontAwesomeIcon icon={faUserTie} className="me-1" />
                            {fonctionnaire?.nom_complet || fonctionnaire?.label || `ID ${id}`}
                        </Badge>
                    );
                })}
            </Stack>
        );
    }, [lookupData.fonctionnaires]);

    const getLookupBadges = useCallback((idsValue, list, badgeBg = "light", badgeText = "dark") => {
        const ids = normalizeIds(idsValue);
        if (!ids.length) return '-';

        return (
            <Stack direction="horizontal" gap={1} className="flex-wrap">
                {ids.map((id, index) => {
                    const item = list.find(entry =>
                        String(entry.value) === String(id) ||
                        String(entry.Id) === String(id) ||
                        String(entry.id) === String(id)
                    );
                    const label = item?.label || item?.Description || item?.Nom || `ID: ${id}`;

                    return (
                        <Badge key={`${id}-${index}`} pill bg={badgeBg} text={badgeText} className="border me-1 mb-1">
                            {String(label).replace('Province:', '').trim()}
                        </Badge>
                    );
                })}
            </Stack>
        );
    }, []);

    if (loading) {
        return (
            <div className="text-center p-5 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <Spinner animation="border" variant="primary" className="me-3" />
                <span className="text-muted fs-5">Chargement du sous-projet...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger" className="m-3 m-md-4 shadow">
                <Alert.Heading>
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                    Erreur de Chargement
                </Alert.Heading>
                <p>{error}</p>
                <hr />
                <Button onClick={onClose} variant="outline-danger" size="sm">Fermer</Button>
            </Alert>
        );
    }

    if (!sousProjetData) {
        return (
            <Alert variant="warning" className="m-3 m-md-4 shadow">
                <Alert.Heading>Donnees indisponibles</Alert.Heading>
                <p>Aucune donnee n'a pu etre chargee pour ce sous-projet (Code: {itemId}).</p>
                <hr />
                <Button onClick={onClose} variant="outline-warning" size="sm">Fermer</Button>
            </Alert>
        );
    }

    const projectLabel = sousProjetData.projet
        ? `${displayData(sousProjetData.projet.Code_Projet)} - ${displayData(sousProjetData.projet.Nom_Projet)}`
        : `(Code: ${displayData(sousProjetData.ID_Projet_Maitre)})`;

    return (
        <div
            className={VISUALISATION_CONTAINER_CLASS}
            style={{ borderRadius: "15px", maxHeight: "90vh", overflowY: "auto", fontSize: "15px" }}
        >
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-2">
                <h3 className="mb-0 fw-bold text-dark">
                    Details Sous-Projet: {displayData(sousProjetData.Code_Sous_Projet)}
                </h3>
                <Button variant="warning" size="sm" onClick={onClose} className={VISUALISATION_CLOSE_BUTTON_CLASS} aria-label="Fermer">
                    Revenir a la liste
                </Button>
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
                                <dt className={DT_CLASS}>Code:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Code_Sous_Projet)}</dd>
                                <dt className={DT_CLASS}>Nom:</dt><dd className={`${DD_CLASS} fw-bold`}>{displayData(sousProjetData.Nom_Projet)}</dd>
                                <dt className={DT_CLASS}>Projet Maitre:</dt><dd className={DD_CLASS}>{projectLabel}</dd>
                                <dt className={DT_CLASS}>Statut:</dt>
                                <dd className={DD_CLASS}><Badge bg="warning" text="dark" className="px-2 py-1">{displayData(sousProjetData.Status)}</Badge></dd>
                                <dt className={DT_CLASS}>Secteur:</dt>
                                <dd className={DD_CLASS}>
                                    {sousProjetData.Secteur ? <Badge bg="info" text="dark" className="px-2 py-1">{sousProjetData.Secteur}</Badge> : '-'}
                                </dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={5}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2 text-warning" />
                                LOCALISATION
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Province(s):</dt><dd className={DD_CLASS}>{getLookupBadges(sousProjetData.Id_Province, lookupData.provinces)}</dd>
                                <dt className={DT_CLASS}>Commune(s):</dt><dd className={DD_CLASS}>{getLookupBadges(sousProjetData.Id_Commune, lookupData.communes, "secondary", "white")}</dd>
                                <dt className={DT_CLASS}>Localite:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Localite)}</dd>
                                <dt className={DT_CLASS}>Centre:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Centre)}</dd>
                                <dt className={DT_CLASS}>Site:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Site)}</dd>
                                <dt className={DT_CLASS}>Douars Desservis:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Douars_Desservis)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={7}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faTasks} className="me-2 text-warning" />
                                DETAILS TECHNIQUES
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Nature Intervention:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Nature_Intervention)}</dd>
                                <dt className={DT_CLASS}>Surface:</dt><dd className={DD_CLASS}>{formatNumber(sousProjetData.Surface)}</dd>
                                <dt className={DT_CLASS}>Lineaire:</dt><dd className={DD_CLASS}>{formatNumber(sousProjetData.Lineaire)}</dd>
                                <dt className={DT_CLASS}>Av. Physique:</dt><dd className={DD_CLASS}><Badge bg="primary">{formatPercentage(sousProjetData.Etat_Avan_Physi)}</Badge></dd>
                                <dt className={DT_CLASS}>Av. Financier:</dt><dd className={DD_CLASS}><Badge bg="success">{formatPercentage(sousProjetData.Etat_Avan_Finan)}</Badge></dd>
                                <dt className={DT_CLASS}>Beneficiaire:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Benificiaire)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={6} lg={5}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faPiggyBank} className="me-2 text-warning" />
                                FINANCEMENT
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Estim. Initiale:</dt><dd className={`${DD_CLASS} fw-bold`}>{formatNumber(sousProjetData.Estim_Initi)} MAD</dd>
                                <dt className={DT_CLASS}>Financement:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Financement)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={12} lg={8}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faCommentDots} className="me-2 text-warning" />
                                OBSERVATIONS
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            <p className="small mb-3 text-muted fst-italic">{displayData(sousProjetData.Observations, "Aucune observation.")}</p>
                            <hr className="my-2" />
                            <dl className={`${DL_CLASS} mt-2`}>
                                <dt className={DT_CLASS}><FontAwesomeIcon icon={faClock} className="me-1 text-muted" />Cree le:</dt><dd className={DD_CLASS}>{formatDate(sousProjetData.created_at)}</dd>
                                <dt className={DT_CLASS}><FontAwesomeIcon icon={faClock} className="me-1 text-muted" />Modifie le:</dt><dd className={DD_CLASS}>{formatDate(sousProjetData.updated_at)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={12} lg={4}>
                    <Card className={CARD_CLASS} style={CARD_ACCENT_STYLE}>
                        <Card.Header className={CARD_HEADER_CLASS}>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faUserTie} className="me-2 text-warning" />
                                POINTS FOCAUX
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-3" style={CARD_BODY_STYLE}>
                            {getFonctionnaireNames(sousProjetData.id_fonctionnaire)}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

SousProjetVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func.isRequired,
    baseApiUrl: PropTypes.string.isRequired,
};

export default SousProjetVisualisation;
