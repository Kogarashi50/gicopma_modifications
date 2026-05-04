import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner,
    faExclamationTriangle,
    faTrashAlt,
    faFilePdf,
    faFileWord,
    faFileExcel,
    faFileImage,
    faFileAlt,
    faPlus,
    faUsers,
    faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import Select from 'react-select';
import {
    Form,
    Button,
    Row,
    Col,
    Card,
    Alert,
    Spinner,
    InputGroup,
    ListGroup,
} from 'react-bootstrap';
import PropTypes from 'prop-types';
import PartenaireManager from '../conventions_views/PartenaireManager';
import PartenaireEngagementManager from '../conventions_views/PartenaireEngagementManager';

const STATUT_OPTIONS = [
    { value: 'approuvé', label: 'Approuvé' },
    { value: 'non visé', label: 'Non Visé' },
    { value: 'en cours de visa', label: 'En Cours de Visa' },
    { value: 'visé', label: 'Visé' },
    { value: 'signé', label: 'Signé' },
];

const TYPE_MODIFICATION_OPTIONS = [
    { value: 'montant', label: 'Modification du Montant' },
    { value: 'durée', label: 'Prolongation de Durée' },
    { value: 'partenaire', label: 'Changement de Partenaire(s)' },
    { value: 'technique_administratif', label: 'Mise à Jour Technique/Administrative' },
    { value: 'autre', label: 'Autres Modifications' },
];

const bilingualLabel = (fr, ar, required = false) => (
    <div className="d-flex justify-content-between align-items-center w-100">
        <span>
            {fr}
            {required && <span className="text-danger ms-1">*</span>}
        </span>
        <span className="text-muted" style={{ fontSize: '0.9em', marginRight: '8px' }}>
            {required && <span className="text-danger me-1">*</span>}
            {ar}
        </span>
    </div>
);

const selectStyles = {
    control: (provided, state) => ({
        ...provided,
        width: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: '1.5rem',
        border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none',
        minHeight: '38px',
        fontSize: '0.875rem',
    }),
    valueContainer: (provided) => ({ ...provided, padding: '0.25rem 0.8rem', flexWrap: 'wrap' }),
    input: (provided) => ({ ...provided, margin: '0px', padding: '0px', fontSize: '0.875rem' }),
    indicatorSeparator: () => ({ display: 'none' }),
    indicatorsContainer: (provided) => ({ ...provided, height: '36px' }),
    placeholder: (provided) => ({ ...provided, color: '#6c757d', fontSize: '0.875rem' }),
    menu: (provided) => ({ ...provided, borderRadius: '0.5rem', zIndex: 1055 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null,
        color: state.isSelected ? 'white' : 'black',
        fontSize: '0.875rem',
        padding: '0.5rem 1rem',
    }),
    multiValue: (provided) => ({ ...provided, backgroundColor: '#e9ecef', borderRadius: '0.5rem', margin: '2px' }),
    multiValueLabel: (provided) => ({ ...provided, color: '#495057', fontSize: '0.8rem' }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: '#6c757d',
        ':hover': { backgroundColor: '#dc3545', color: 'white' },
    }),
};

const parseCurrency = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (typeof value === 'number') return value;

    const cleaned = value
        .replace(/[\s\u00A0]/g, '')
        .replace(/[^0-9,.-]/g, '')
        .replace(',', '.');

    const number = parseFloat(cleaned);
    return Number.isNaN(number) ? null : number;
};

const getFileIcon = (filenameOrMimeType) => {
    if (!filenameOrMimeType) return faFileAlt;

    const value = String(filenameOrMimeType).toLowerCase();
    if (value.includes('pdf')) return faFilePdf;
    if (value.includes('doc') || value.includes('word')) return faFileWord;
    if (value.includes('xls') || value.includes('excel')) return faFileExcel;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].some((ext) => value.endsWith(ext)) || value.startsWith('image/')) {
        return faFileImage;
    }

    return faFileAlt;
};

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const mapConventionOptions = (data) => (data || [])
    .filter((item) => item?.value !== undefined && item?.label !== undefined)
    .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));

const mapFonctionnaireOptions = (data) => {
    const rawData = Array.isArray(data?.fonctionnaires) ? data.fonctionnaires : Array.isArray(data) ? data : [];

    return rawData
        .map((item) => ({
            value: item.id ?? item.value,
            label: item.nom_complet ?? item.label ?? `Fonctionnaire ID ${item.id ?? item.value}`,
        }))
        .filter((item) => item.value !== undefined && item.label !== undefined)
        .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
};

const AvenantForm = ({
    itemId = null,
    onClose,
    onItemCreated,
    onItemUpdated,
    initialConventionId = null,
    conventionCode = '',
    baseApiUrl = 'http://localhost:8000/api',
}) => {
    const initialFormData = useMemo(() => ({
        convention_id: initialConventionId || '',
        numero_avenant: '',
        date_signature: '',
        objet: '',
        type_modification: [],
        montant_avenant: '',
        montant_modifie: '',
        annee_avenant: new Date().getFullYear(),
        session: '',
        numero_approbation: '',
        statut: null,
        date_visa: '',
        nouvelle_date_fin: '',
        remarques: '',
        fonctionnaires: [],
    }), [initialConventionId]);

    const [formData, setFormData] = useState(initialFormData);
    const [conventionOptions, setConventionOptions] = useState([]);
    const [fonctionnairesOptions, setFonctionnairesOptions] = useState([]);
    const [engagementTypes, setEngagementTypes] = useState([]);
    const [selectedPartenaires, setSelectedPartenaires] = useState([]);
    const [partnerEngagements, setPartnerEngagements] = useState([]);
    const [fichiers, setFichiers] = useState([]);
    const [existingFichiers, setExistingFichiers] = useState([]);
    const [fichiersToDelete, setFichiersToDelete] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [loadingData, setLoadingData] = useState(!!itemId);
    const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: null, success: false });
    const [formErrors, setFormErrors] = useState({});
    const [selectedConventionDetails, setSelectedConventionDetails] = useState(null);

    const isEditing = useMemo(() => itemId !== null, [itemId]);
    const storageBaseUrl = useMemo(() => baseApiUrl.replace('/api', ''), [baseApiUrl]);
    const selectedTypeValues = useMemo(() => formData.type_modification?.map((type) => type.value) || [], [formData.type_modification]);
    const buttonCloseClass = 'btn rounded-5 px-5 py-2 bg-warning shadow-sm fw-bold border-0';

    const clearFieldError = useCallback((field) => {
        setFormErrors((previous) => {
            if (!previous[field]) return previous;
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }, []);

    const fetchConventionDetails = useCallback(async (conventionId) => {
        if (!conventionId) {
            setSelectedConventionDetails(null);
            return;
        }

        try {
            const response = await axios.get(`${baseApiUrl}/conventions/${conventionId}`, { withCredentials: true });
            const details = response.data.convention || response.data;
            setSelectedConventionDetails(details || null);
        } catch (error) {
            console.error('Failed to fetch convention details:', error);
            setSelectedConventionDetails(null);
        }
    }, [baseApiUrl]);

    const fetchOptions = useCallback(async () => {
        setLoadingOptions(true);
        setSubmissionStatus((previous) => ({ ...previous, error: null }));

        try {
            const [conventionsResponse, fonctionnairesResponse, engagementTypesResponse] = await Promise.all([
                axios.get(`${baseApiUrl}/options/conventions`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/options/fonctionnaires`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/options/engagement-types`, { withCredentials: true }),
            ]);

            setConventionOptions(mapConventionOptions(conventionsResponse.data));
            setFonctionnairesOptions(mapFonctionnaireOptions(fonctionnairesResponse.data));
            setEngagementTypes(Array.isArray(engagementTypesResponse.data) ? engagementTypesResponse.data : []);
        } catch (error) {
            console.error('AvenantForm: erreur chargement options:', error.response || error);
            setSubmissionStatus((previous) => ({ ...previous, error: 'Erreur chargement des listes.', loading: false }));
        } finally {
            setLoadingOptions(false);
        }
    }, [baseApiUrl]);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    useEffect(() => {
        if (isEditing || !initialConventionId) return;
        fetchConventionDetails(initialConventionId);
    }, [isEditing, initialConventionId, fetchConventionDetails]);

    useEffect(() => {
        if (!isEditing || !itemId || loadingOptions) {
            if (!itemId) setLoadingData(false);
            return;
        }

        let isMounted = true;

        const fetchAvenantData = async () => {
            setLoadingData(true);
            setSubmissionStatus({ loading: false, error: null, success: false });
            setFormErrors({});

            try {
                const response = await axios.get(`${baseApiUrl}/avenants/${itemId}`, {
                    params: {
                        include: 'convention,documents,partnerCommitments.partenaire,partnerCommitments.engagementType,partnerCommitments.engagementsAnnuels',
                    },
                    withCredentials: true,
                });

                if (!isMounted) return;

                const data = response.data.avenant || response.data;
                const convention = data.convention || null;

                if (convention) {
                    setSelectedConventionDetails(convention);
                } else if (data.convention_id) {
                    fetchConventionDetails(data.convention_id);
                }

                const findOption = (options, value) => options.find(
                    (option) => String(option.value).toLowerCase() === String(value).toLowerCase(),
                ) || null;

                const findMultiOptions = (options, values) => {
                    if (!Array.isArray(values)) return [];
                    return options.filter((option) => values.map(String).includes(String(option.value)));
                };

                const fonctionnaireIds = new Set(
                    String(data.id_fonctionnaire || '')
                        .split(';')
                        .map((id) => id.trim())
                        .filter(Boolean),
                );

                setFormData({
                    convention_id: data.convention_id || '',
                    numero_avenant: data.numero_avenant || '',
                    date_signature: data.date_signature || '',
                    objet: data.objet || '',
                    annee_avenant: data.annee_avenant || new Date().getFullYear(),
                    session: data.session || '',
                    numero_approbation: data.numero_approbation || '',
                    statut: findOption(STATUT_OPTIONS, data.statut),
                    date_visa: data.date_visa || '',
                    type_modification: findMultiOptions(TYPE_MODIFICATION_OPTIONS, data.type_modification),
                    montant_avenant: data.montant_avenant != null ? String(data.montant_avenant) : '',
                    montant_modifie: data.montant_modifie != null ? String(data.montant_modifie) : '',
                    nouvelle_date_fin: data.nouvelle_date_fin || '',
                    remarques: data.remarques || '',
                    fonctionnaires: fonctionnairesOptions.filter((option) => fonctionnaireIds.has(String(option.value))),
                });

                setExistingFichiers((data.documents || []).map((file) => {
                    const filePath = file.file_path ? file.file_path.replace(/^\//, '') : '';

                    return {
                        id: file.Id_Doc || file.id,
                        Id_Doc: file.Id_Doc || file.id,
                        file_name: file.file_name || file.nom_fichier,
                        fichier_url: file.fichier_url || file.url || (filePath ? `${storageBaseUrl}/${filePath}` : ''),
                        intitule: file.Intitule || file.intitule || '',
                    };
                }));

                const commitments = data.partner_commitments || data.partnerCommitments || [];
                const isPartnerModification = Array.isArray(data.type_modification) && data.type_modification.includes('partenaire');

                if (isPartnerModification && commitments.length > 0) {
                    const uniquePartners = [];
                    const partnerIds = new Set();

                    commitments.forEach((commitment) => {
                        const partnerId = commitment.Id_Partenaire ?? commitment.partenaire_id;
                        if (!partnerId || partnerIds.has(partnerId)) return;

                        const partner = commitment.partenaire || {};
                        let label = partner.Description_Arr || partner.Description || partner.label || `Partenaire ID ${partnerId}`;
                        if (partner.Code) label = `${partner.Code} - ${label}`;

                        uniquePartners.push({ value: partnerId, label });
                        partnerIds.add(partnerId);
                    });

                    setSelectedPartenaires(uniquePartners);
                    setPartnerEngagements(commitments.map((commitment) => {
                        const partnerId = commitment.Id_Partenaire ?? commitment.partenaire_id;
                        const partner = commitment.partenaire || {};
                        let partnerLabel = partner.Description_Arr || partner.Description || partner.label || `Partenaire ID ${partnerId}`;
                        if (partner.Code) partnerLabel = `${partner.Code} - ${partnerLabel}`;

                        return {
                            id: commitment.Id_CP ?? commitment.id ?? generateTempId(),
                            partenaire_id: partnerId,
                            partenaire_label: partnerLabel,
                            engagement_type_id: commitment.engagement_type_id ?? null,
                            engagement_type_label: commitment.engagement_type?.nom || commitment.engagementType?.nom || '',
                            montant_convenu: commitment.Montant_Convenu != null ? String(commitment.Montant_Convenu) : '',
                            autre_engagement: commitment.autre_engagement || '',
                            engagement_description: commitment.engagement_description || '',
                            is_signatory: !!commitment.is_signatory,
                            date_signature: commitment.date_signature || '',
                            details_signature: commitment.details_signature || '',
                            engagements_annuels: (commitment.engagements_annuels || commitment.engagementsAnnuels || []).map((yearly) => ({
                                annee: yearly.annee,
                                montant_prevu: yearly.montant_prevu != null ? String(yearly.montant_prevu) : '',
                            })),
                        };
                    }));
                } else {
                    setSelectedPartenaires([]);
                    setPartnerEngagements([]);
                }

                setFichiers([]);
                setFichiersToDelete([]);
            } catch (error) {
                console.error('AvenantForm: erreur chargement données:', error.response || error);
                if (isMounted) {
                    setSubmissionStatus({ loading: false, error: 'Erreur chargement des données.', success: false });
                }
            } finally {
                if (isMounted) setLoadingData(false);
            }
        };

        fetchAvenantData();

        return () => {
            isMounted = false;
        };
    }, [itemId, isEditing, baseApiUrl, loadingOptions, fonctionnairesOptions, storageBaseUrl, fetchConventionDetails]);

    useEffect(() => {
        if (isEditing || loadingOptions) return;

        setFormData(initialFormData);
        setFichiers([]);
        setExistingFichiers([]);
        setFichiersToDelete([]);
        setSelectedPartenaires([]);
        setPartnerEngagements([]);
        setFormErrors({});
        setSubmissionStatus({ loading: false, error: null, success: false });
        setLoadingData(false);
    }, [isEditing, loadingOptions, initialFormData]);

    useEffect(() => {
        if (!selectedTypeValues.includes('montant')) return;

        const conventionAmount = parseCurrency(selectedConventionDetails?.Cout_Global);
        const avenantAmount = parseCurrency(formData.montant_avenant);

        if (conventionAmount !== null && avenantAmount !== null) {
            setFormData((previous) => ({
                ...previous,
                montant_modifie: String((conventionAmount + avenantAmount).toFixed(2)),
            }));
        } else {
            setFormData((previous) => ({ ...previous, montant_modifie: '' }));
        }
    }, [formData.montant_avenant, selectedConventionDetails, selectedTypeValues]);

    const validateForm = useCallback(() => {
        const errors = {};

        if (!formData.convention_id) errors.convention_id = 'Convention requise.';
        if (!formData.numero_avenant?.trim()) errors.numero_avenant = 'Numéro avenant requis.';
        if (!formData.numero_approbation?.trim()) errors.numero_approbation = 'Numéro approbation requis.';
        if (!formData.session) errors.session = 'Session requise.';
        if (!formData.annee_avenant) errors.annee_avenant = 'Année avenant requise.';
        if (!formData.type_modification || formData.type_modification.length === 0) {
            errors.type_modification = 'Type modification requis.';
        }

        if (formData.statut?.value === 'signé' && !formData.date_signature) {
            errors.date_signature = "Date signature requise pour le statut 'Signé'.";
        }

        if (formData.statut?.value === 'visé' && !formData.date_visa) {
            errors.date_visa = "Date de visa requise pour le statut 'Visé'.";
        }

        if (selectedTypeValues.includes('montant')) {
            const montantAvenant = parseCurrency(formData.montant_avenant);
            const montantModifie = parseCurrency(formData.montant_modifie);

            if (montantAvenant === null) {
                errors.montant_avenant = "Le montant de l'avenant est requis.";
            }

            if (montantModifie === null) {
                errors.montant_modifie = 'Le nouveau montant global est invalide.';
            }
        }

        if (selectedTypeValues.includes('durée') && !formData.nouvelle_date_fin) {
            errors.nouvelle_date_fin = 'Nouvelle date fin requise.';
        }

        if (selectedTypeValues.includes('partenaire')) {
            if (!selectedPartenaires.length) {
                errors.partenaires = 'Au moins un partenaire requis.';
            }

            partnerEngagements.forEach((engagement, index) => {
                const keyPrefix = `engagement_${index + 1}`;

                if (!engagement.partenaire_id) {
                    errors[`${keyPrefix}_partenaire`] = 'Partenaire requis.';
                }

                if (engagement.montant_convenu !== '' && engagement.montant_convenu !== null && engagement.montant_convenu !== undefined) {
                    const amount = parseCurrency(engagement.montant_convenu);
                    if (amount === null || amount < 0) {
                        errors[`${keyPrefix}_montant`] = 'Montant engagement invalide.';
                    }
                }

                if (engagement.is_signatory && !engagement.date_signature) {
                    errors[`${keyPrefix}_date_signature`] = 'Date signature partenaire requise.';
                }

                (engagement.engagements_annuels || []).forEach((yearly, yearlyIndex) => {
                    const yearlyAmount = parseCurrency(yearly.montant_prevu);
                    if (yearly.montant_prevu !== '' && yearlyAmount === null) {
                        errors[`${keyPrefix}_yearly_${yearlyIndex}`] = 'Montant annuel invalide.';
                    }
                });
            });
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, selectedTypeValues, selectedPartenaires, partnerEngagements]);

    const handleChange = useCallback((event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
        clearFieldError(name);
    }, [clearFieldError]);

    const handleStatutChange = useCallback((selectedOption) => {
        setFormData((previous) => ({
            ...previous,
            statut: selectedOption,
            date_visa: selectedOption?.value === 'visé' ? previous.date_visa : '',
            date_signature: selectedOption?.value === 'signé' ? previous.date_signature : '',
        }));
        clearFieldError('statut');
        clearFieldError('date_visa');
        clearFieldError('date_signature');
    }, [clearFieldError]);

    const handleSelectChange = useCallback(async (selectedOption, actionMeta) => {
        const name = actionMeta?.name;
        if (!name) return;

        if (name === 'convention_id') {
            const conventionId = selectedOption?.value || '';
            setFormData((previous) => ({ ...previous, convention_id: conventionId }));
            clearFieldError('convention_id');
            await fetchConventionDetails(conventionId);
            return;
        }

        if (name === 'type_modification') {
            const selectedOptions = selectedOption || [];
            const values = selectedOptions.map((option) => option.value);

            setFormData((previous) => ({
                ...previous,
                type_modification: selectedOptions,
                montant_avenant: values.includes('montant') ? previous.montant_avenant : '',
                montant_modifie: values.includes('montant') ? previous.montant_modifie : '',
                nouvelle_date_fin: values.includes('durée') ? previous.nouvelle_date_fin : '',
            }));

            if (!values.includes('partenaire')) {
                setSelectedPartenaires([]);
                setPartnerEngagements([]);
            }

            setFormErrors((previous) => {
                const next = { ...previous };
                delete next.type_modification;
                if (!values.includes('montant')) {
                    delete next.montant_avenant;
                    delete next.montant_modifie;
                }
                if (!values.includes('durée')) delete next.nouvelle_date_fin;
                if (!values.includes('partenaire')) {
                    delete next.partenaires;
                    delete next.partnerEngagements;
                }
                return next;
            });
            return;
        }

        if (name === 'fonctionnaires') {
            setFormData((previous) => ({ ...previous, fonctionnaires: selectedOption || [] }));
            return;
        }

        setFormData((previous) => ({ ...previous, [name]: selectedOption }));
        clearFieldError(name);
    }, [clearFieldError, fetchConventionDetails]);

    const handleEngagementsChange = useCallback((engagements) => {
        setPartnerEngagements(engagements || []);
        clearFieldError('partnerEngagements');
        clearFieldError('partenaires');
    }, [clearFieldError]);

    const handlePartenairesChange = useCallback((partenaires) => {
        setSelectedPartenaires(partenaires || []);
        clearFieldError('partenaires');
        clearFieldError('partnerEngagements');
    }, [clearFieldError]);

    const handleFileChange = useCallback((event) => {
        const filesToAdd = Array.from(event.target.files || []);
        if (!filesToAdd.length) return;

        setFichiers((previous) => {
            const existingNames = new Set(previous.map((fileWrapper) => fileWrapper.file.name));
            const uniqueFiles = filesToAdd
                .filter((file) => !existingNames.has(file.name))
                .map((file) => ({ file, intitule: file.name.replace(/\.[^/.]+$/, '') }));

            return [...previous, ...uniqueFiles];
        });

        event.target.value = null;
    }, []);

    const removeNewFile = useCallback((index) => {
        setFichiers((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
    }, []);

    const removeExistingFile = useCallback((fileId) => {
        setFichiersToDelete((previous) => [...new Set([...previous, fileId])]);
    }, []);

    const appendFormData = useCallback((dataToSubmit) => {
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'statut') {
                dataToSubmit.append('statut', value?.value || '');
                return;
            }

            if (key === 'type_modification') {
                (value || []).forEach((type, index) => {
                    dataToSubmit.append(`type_modification[${index}]`, type.value);
                });
                return;
            }

            if (key === 'fonctionnaires') {
                dataToSubmit.append('id_fonctionnaire', (value || []).map((fonctionnaire) => fonctionnaire.value).join(';'));
                return;
            }

            if (key === 'montant_avenant' || key === 'montant_modifie') {
                dataToSubmit.append(key, value !== '' ? String(parseCurrency(value)) : '');
                return;
            }

            dataToSubmit.append(key, value ?? '');
        });
    }, [formData]);

    const appendPartnerCommitments = useCallback((dataToSubmit) => {
        if (!selectedTypeValues.includes('partenaire')) return;

        const payloadByPartner = new Map(selectedPartenaires.map((partenaire) => [
            String(partenaire.value),
            {
                id_cp: null,
                Id_Partenaire: partenaire.value,
                engagement_type_id: null,
                Montant_Convenu: null,
                autre_engagement: null,
                engagement_description: null,
                is_signatory: false,
                date_signature: null,
                details_signature: null,
                engagements_annuels: [],
            },
        ]));

        partnerEngagements.forEach((engagement) => {
            if (!engagement.partenaire_id) return;

            payloadByPartner.set(String(engagement.partenaire_id), {
                id_cp: typeof engagement.id === 'number' ? engagement.id : null,
                Id_Partenaire: engagement.partenaire_id,
                engagement_type_id: engagement.engagement_type_id || null,
                Montant_Convenu: engagement.montant_convenu !== '' && engagement.montant_convenu !== null && engagement.montant_convenu !== undefined
                    ? parseCurrency(engagement.montant_convenu)
                    : null,
                autre_engagement: engagement.autre_engagement || null,
                engagement_description: engagement.engagement_description || null,
                is_signatory: !!engagement.is_signatory,
                date_signature: engagement.is_signatory ? engagement.date_signature : null,
                details_signature: engagement.is_signatory ? engagement.details_signature : null,
                engagements_annuels: (engagement.engagements_annuels || []).map((yearly) => ({
                    annee: yearly.annee,
                    montant_prevu: parseCurrency(yearly.montant_prevu),
                })),
            });
        });

        const payload = Array.from(payloadByPartner.values());

        dataToSubmit.append('avenant_partner_commitments', JSON.stringify(payload));
    }, [selectedTypeValues, selectedPartenaires, partnerEngagements]);

    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            setSubmissionStatus({ loading: false, error: 'Veuillez corriger les erreurs.', success: false });
            document.querySelector('.is-invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmissionStatus({ loading: true, error: null, success: false });

        const dataToSubmit = new FormData();
        appendFormData(dataToSubmit);
        appendPartnerCommitments(dataToSubmit);

        fichiers.forEach((fileWrapper, index) => {
            dataToSubmit.append(`fichiers[${index}]`, fileWrapper.file);
            dataToSubmit.append(`intitules[${index}]`, fileWrapper.intitule);
        });

        if (isEditing) {
            dataToSubmit.append('_method', 'PUT');

            const documentsMeta = existingFichiers.map((file) => ({
                id: file.id,
                intitule: String(file.intitule || '').trim(),
            }));

            dataToSubmit.append('existing_documents_meta', JSON.stringify(documentsMeta));
            fichiersToDelete.forEach((fileId) => dataToSubmit.append('fichiers_to_delete[]', fileId));
        }

        const url = isEditing ? `${baseApiUrl}/avenants/${itemId}` : `${baseApiUrl}/avenants`;

        try {
            const response = await axios.post(url, dataToSubmit, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
            });

            setSubmissionStatus({ loading: false, error: null, success: true });

            if (isEditing) {
                onItemUpdated(response.data.avenant);
            } else {
                onItemCreated(response.data.avenant);
            }

            setTimeout(onClose, 1200);
        } catch (error) {
            console.error('AvenantForm: erreur submit:', error.response || error);

            const response = error.response;
            setFormErrors(response?.data?.errors || {});
            setSubmissionStatus({
                loading: false,
                error: response?.data?.message || 'Erreur serveur.',
                success: false,
            });
        }
    }, [
        validateForm,
        appendFormData,
        appendPartnerCommitments,
        fichiers,
        isEditing,
        existingFichiers,
        fichiersToDelete,
        baseApiUrl,
        itemId,
        onItemUpdated,
        onItemCreated,
        onClose,
    ]);

    const isSubmitDisabled = submissionStatus.loading || loadingData || loadingOptions;
    const visibleExistingFichiers = existingFichiers.filter((file) => !fichiersToDelete.includes(file.id));

    if (loadingData || loadingOptions) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '400px' }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-3 text-muted">Chargement du formulaire...</span>
            </div>
        );
    }

    return (
        <div
            className="p-3 p-md-4 avenant-form-container bg-white"
            style={{
                borderRadius: '15px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: 'calc(90vh - 100px)',
                overflowY: 'auto',
            }}
        >
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <div>
                    <h5 className="text-uppercase fw-bold text-secondary mb-1">
                        {isEditing ? 'Modifier' : 'Ajouter un nouveau'}
                    </h5>
                    <h2 className="mb-0 fw-bold">
                        Avenant{conventionCode ? ` à la Convention ${conventionCode}` : ''}
                    </h2>
                </div>
                <Button variant="warning" onClick={onClose} size="sm" className={buttonCloseClass}>
                    <b>Revenir à la liste</b>
                </Button>
            </div>

            {submissionStatus.error && !submissionStatus.loading && (
                <Alert variant="danger" className="mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                    {submissionStatus.error}
                </Alert>
            )}

            {submissionStatus.success && (
                <Alert variant="success" className="mb-3">
                    Avenant {isEditing ? 'modifié' : 'ajouté'} avec succès !
                </Alert>
            )}

            <Form noValidate onSubmit={handleSubmit} className="px-md-3">
                <Form.Group as={Row} className="mb-3 align-items-center" controlId="formConventionId">
                    <Form.Label column sm={3} className="small fw-medium text-sm-end">
                        {bilingualLabel('Convention', 'الاتفاقية', true)}
                    </Form.Label>
                    <Col sm={9}>
                        <Select
                            inputId="convention-select-input"
                            name="convention_id"
                            options={conventionOptions}
                            value={conventionOptions.find((option) => option.value === formData.convention_id) || null}
                            onChange={handleSelectChange}
                            styles={selectStyles}
                            placeholder="- Sélectionner Convention Parente -"
                            isClearable={false}
                            isDisabled={isEditing}
                            className={formErrors.convention_id ? 'is-invalid' : ''}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            menuPlacement="auto"
                        />
                        {formErrors.convention_id && <div className="invalid-feedback d-block ps-1 small">{formErrors.convention_id}</div>}
                    </Col>
                </Form.Group>

                <Row className="g-3 mb-3">
                    <Form.Group as={Col} md={4} controlId="formNumeroApprobation">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('N° Approbation', 'رقم الموافقة', true)}
                        </Form.Label>
                        <Form.Control
                            className="p-2 rounded-pill shadow-sm bg-white border-1"
                            isInvalid={!!formErrors.numero_approbation}
                            type="text"
                            name="numero_approbation"
                            value={formData.numero_approbation}
                            onChange={handleChange}
                            size="sm"
                        />
                        <Form.Control.Feedback type="invalid">{formErrors.numero_approbation}</Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group as={Col} md={4} controlId="formSession">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('Session', 'الدورة', true)}
                        </Form.Label>
                        <Form.Select
                            className="p-2 rounded-pill shadow-sm bg-white border-1"
                            name="session"
                            value={formData.session}
                            onChange={handleChange}
                            isInvalid={!!formErrors.session}
                            size="sm"
                        >
                            <option value="">Sélectionner...</option>
                            {[...Array(12).keys()].map((index) => (
                                <option key={index + 1} value={index + 1}>
                                    {new Date(0, index).toLocaleString('fr', { month: 'long' })}
                                </option>
                            ))}
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">{formErrors.session}</Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group as={Col} md={4} controlId="formAnneeAvenant">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('Année Avenant', 'سنة الإضافة', true)}
                        </Form.Label>
                        <Form.Control
                            className="p-2 rounded-pill shadow-sm bg-white border-1"
                            isInvalid={!!formErrors.annee_avenant}
                            type="number"
                            name="annee_avenant"
                            value={formData.annee_avenant}
                            onChange={handleChange}
                            size="sm"
                            placeholder="YYYY"
                        />
                        <Form.Control.Feedback type="invalid">{formErrors.annee_avenant}</Form.Control.Feedback>
                    </Form.Group>
                </Row>

                <Row className="g-3 mb-3">
                    <Form.Group as={Col} md={4} controlId="formNumeroAvenant">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('N° Avenant', 'رقم الإضافة', true)}
                        </Form.Label>
                        <Form.Control
                            className="p-2 rounded-pill shadow-sm bg-white border-1"
                            isInvalid={!!formErrors.numero_avenant}
                            type="text"
                            name="numero_avenant"
                            value={formData.numero_avenant}
                            onChange={handleChange}
                            size="sm"
                            placeholder="Ex: Avenant N°1"
                        />
                        <Form.Control.Feedback type="invalid">{formErrors.numero_avenant}</Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group as={Col} md={4} controlId="formStatut">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('Statut', 'الحالة')}
                        </Form.Label>
                        <Select
                            inputId="statut-select-input"
                            name="statut"
                            options={STATUT_OPTIONS}
                            value={formData.statut}
                            onChange={handleStatutChange}
                            styles={selectStyles}
                            placeholder="- Sélectionner Statut -"
                            isClearable
                            className={formErrors.statut ? 'is-invalid' : ''}
                            classNamePrefix="react-select"
                        />
                        {formErrors.statut && <div className="invalid-feedback d-block">{formErrors.statut}</div>}
                    </Form.Group>

                    {formData.statut?.value === 'signé' && (
                        <Form.Group as={Col} md={4} controlId="formDateSignature">
                            <Form.Label className="small mb-1 fw-medium w-100">
                                {bilingualLabel('Date Signature', 'تاريخ التوقيع', true)}
                            </Form.Label>
                            <Form.Control
                                className="p-2 rounded-pill shadow-sm bg-white border-1"
                                isInvalid={!!formErrors.date_signature}
                                type="date"
                                name="date_signature"
                                value={formData.date_signature}
                                onChange={handleChange}
                                size="sm"
                            />
                            <Form.Control.Feedback type="invalid">{formErrors.date_signature}</Form.Control.Feedback>
                        </Form.Group>
                    )}
                </Row>

                <Row className="g-3 mb-3">
                    <Form.Group as={Col} controlId="formTypeModification">
                        <Form.Label className="small mb-1 fw-medium w-100">
                            {bilingualLabel('Type Modification', 'نوع التعديل', true)}
                        </Form.Label>
                        <Select
                            inputId="type-modification-select-input"
                            name="type_modification"
                            options={TYPE_MODIFICATION_OPTIONS}
                            value={formData.type_modification}
                            onChange={handleSelectChange}
                            styles={selectStyles}
                            placeholder="- Sélectionner Type(s) -"
                            isMulti
                            isClearable
                            closeMenuOnSelect={false}
                            className={formErrors.type_modification ? 'is-invalid' : ''}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            menuPlacement="auto"
                        />
                        {formErrors.type_modification && <div className="invalid-feedback d-block">{formErrors.type_modification}</div>}
                    </Form.Group>

                    {formData.statut?.value === 'visé' && (
                        <Form.Group as={Col} md={4} controlId="formDateVisa">
                            <Form.Label className="small mb-1 fw-medium">
                                Date de visa <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                className="p-2 rounded-pill shadow-sm bg-white border-1"
                                isInvalid={!!formErrors.date_visa}
                                type="date"
                                name="date_visa"
                                value={formData.date_visa}
                                onChange={handleChange}
                                size="sm"
                            />
                            <Form.Control.Feedback type="invalid">{formErrors.date_visa}</Form.Control.Feedback>
                        </Form.Group>
                    )}
                </Row>

                {selectedTypeValues.includes('montant') && (
                    <Row className="g-3 mb-3 p-3 border rounded-3 bg-light">
                        <Form.Group as={Col} md={4} controlId="formMontantInitial">
                            <Form.Label className="small mb-1 fw-medium">Montant Initial Convention</Form.Label>
                            <InputGroup size="sm">
                                <Form.Control
                                    className="p-2 rounded-start-pill bg-light"
                                    type="text"
                                    value={selectedConventionDetails?.Cout_Global != null ? parseFloat(selectedConventionDetails.Cout_Global).toLocaleString('fr-MA') : 'N/A'}
                                    readOnly
                                    disabled
                                />
                                <InputGroup.Text className="rounded-end-pill">MAD</InputGroup.Text>
                            </InputGroup>
                        </Form.Group>

                        <Form.Group as={Col} md={4} controlId="formMontantAvenant">
                            <Form.Label className="small mb-1 fw-medium">
                                {bilingualLabel("Montant de l'Avenant", 'مبلغ الإضافة', true)}
                            </Form.Label>
                            <InputGroup size="sm">
                                <Form.Control
                                    className="p-2 rounded-start-pill shadow-sm bg-white border-1"
                                    isInvalid={!!formErrors.montant_avenant}
                                    type="number"
                                    step="0.01"
                                    name="montant_avenant"
                                    value={formData.montant_avenant}
                                    onChange={handleChange}
                                    placeholder="Ex: 50000 ou -10000"
                                />
                                <InputGroup.Text className="rounded-end-pill">MAD</InputGroup.Text>
                                <Form.Control.Feedback type="invalid">{formErrors.montant_avenant}</Form.Control.Feedback>
                            </InputGroup>
                        </Form.Group>

                        <Form.Group as={Col} md={4} controlId="formMontantModifie">
                            <Form.Label className="small mb-1 fw-medium">Nouveau Montant Global</Form.Label>
                            <InputGroup size="sm">
                                <Form.Control
                                    className="p-2 rounded-start-pill bg-light fw-bold"
                                    isInvalid={!!formErrors.montant_modifie}
                                    type="text"
                                    name="montant_modifie"
                                    value={formData.montant_modifie !== '' ? parseFloat(formData.montant_modifie).toLocaleString('fr-MA') : ''}
                                    readOnly
                                    disabled
                                />
                                <InputGroup.Text className="rounded-end-pill">MAD</InputGroup.Text>
                                <Form.Control.Feedback type="invalid">{formErrors.montant_modifie}</Form.Control.Feedback>
                            </InputGroup>
                        </Form.Group>
                    </Row>
                )}

                {selectedTypeValues.includes('durée') && (
                    <Row className="g-3 mb-3">
                        <Form.Group as={Col} md={6} controlId="formNouvelleDateFin">
                            <Form.Label className="small mb-1 fw-medium w-100">
                                {bilingualLabel('Nouvelle Date Fin', 'تاريخ الانتهاء الجديد', true)}
                            </Form.Label>
                            <Form.Control
                                className="p-2 rounded-pill shadow-sm bg-white border-1"
                                isInvalid={!!formErrors.nouvelle_date_fin}
                                type="date"
                                name="nouvelle_date_fin"
                                value={formData.nouvelle_date_fin}
                                onChange={handleChange}
                                size="sm"
                            />
                            <Form.Control.Feedback type="invalid">{formErrors.nouvelle_date_fin}</Form.Control.Feedback>
                        </Form.Group>
                    </Row>
                )}

                {selectedTypeValues.includes('partenaire') && (
                    <Card className="mb-3 shadow-sm">
                        <Card.Header className="py-2">
                            <h6 className="mb-0 fw-bold text-success">
                                <FontAwesomeIcon icon={faHandshake} className="me-2" />
                                Partenaires & Engagements
                            </h6>
                        </Card.Header>
                        <Card.Body className="p-3 bg-light">
                            {formErrors.partenaires && <Alert variant="danger" className="py-1">{formErrors.partenaires}</Alert>}
                            {formErrors.partnerEngagements && <Alert variant="danger" className="py-1">{formErrors.partnerEngagements}</Alert>}

                            <PartenaireManager
                                selectedPartenaires={selectedPartenaires}
                                onSelectionChange={handlePartenairesChange}
                                baseApiUrl={baseApiUrl}
                            />

                            {selectedPartenaires.length > 0 && (
                                <div className="mt-4">
                                    <PartenaireEngagementManager
                                        selectedPartenaires={selectedPartenaires}
                                        onEngagementsChange={handleEngagementsChange}
                                        engagementTypes={engagementTypes}
                                        initialEngagements={partnerEngagements}
                                        conventionYear={selectedConventionDetails?.Annee_Convention || formData.annee_avenant}
                                        conventionDuration={selectedConventionDetails?.duree_convention}
                                        conventionCoutGlobal={formData.montant_modifie || selectedConventionDetails?.Cout_Global}
                                    />
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                )}

                <Form.Group className="mb-3" controlId="formObjet">
                    <Form.Label className="small fw-medium">Objet</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="objet"
                        value={formData.objet}
                        onChange={handleChange}
                        size="sm"
                    />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formRemarques">
                    <Form.Label className="small fw-medium">Remarques</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="remarques"
                        value={formData.remarques}
                        onChange={handleChange}
                        size="sm"
                    />
                </Form.Group>

                <Form.Group as={Row} className="mb-3 align-items-center" controlId="formFonctionnaires">
                    <Form.Label column sm={3} className="small text-sm-end">
                        <FontAwesomeIcon icon={faUsers} className="me-1" />
                        Points Focaux
                    </Form.Label>
                    <Col sm={9}>
                        <Select
                            name="fonctionnaires"
                            options={fonctionnairesOptions}
                            value={formData.fonctionnaires}
                            onChange={(option, action) => handleSelectChange(option, { ...action, name: 'fonctionnaires' })}
                            styles={selectStyles}
                            placeholder="- Sélectionner -"
                            isMulti
                            closeMenuOnSelect={false}
                            menuPortalTarget={document.body}
                        />
                    </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-3" controlId="formFichiers">
                    <Form.Label column sm={3} className="small text-sm-end">Fichiers</Form.Label>
                    <Col sm={9}>
                        <Card className="border-dashed">
                            <Card.Body className="p-3">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className="mb-2"
                                    onClick={() => document.getElementById('avenant-file-input')?.click()}
                                >
                                    <FontAwesomeIcon icon={faPlus} className="me-2" />
                                    Ajouter
                                </Button>

                                <Form.Control
                                    id="avenant-file-input"
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />

                                {visibleExistingFichiers.length > 0 && (
                                    <ListGroup variant="flush" className="mb-2">
                                        {visibleExistingFichiers.map((file) => (
                                            <ListGroup.Item key={file.id} className="d-flex justify-content-between align-items-center p-2">
                                                <span>
                                                    <FontAwesomeIcon icon={getFileIcon(file.file_name)} className="me-2" />
                                                    {file.intitule || file.file_name}
                                                </span>
                                                <Button variant="outline-danger" size="sm" onClick={() => removeExistingFile(file.id)}>
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </Button>
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                )}

                                {fichiers.length > 0 && (
                                    <ListGroup variant="flush">
                                        {fichiers.map((fileWrapper, index) => (
                                            <ListGroup.Item key={`${fileWrapper.file.name}-${index}`} className="d-flex justify-content-between align-items-center p-2">
                                                <span>
                                                    <FontAwesomeIcon icon={getFileIcon(fileWrapper.file.name)} className="me-2" />
                                                    {fileWrapper.intitule}
                                                </span>
                                                <Button variant="outline-danger" size="sm" onClick={() => removeNewFile(index)}>
                                                    <FontAwesomeIcon icon={faTrashAlt} />
                                                </Button>
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Form.Group>

                <Row className="mt-4 pt-3 border-top justify-content-center">
                    <Col xs="auto">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="px-5 rounded-pill"
                            disabled={submissionStatus.loading}
                        >
                            Annuler
                        </Button>
                    </Col>
                    <Col xs="auto">
                        <Button
                            type="submit"
                            variant="primary"
                            className="px-5 rounded-pill"
                            disabled={isSubmitDisabled}
                        >
                            {submissionStatus.loading ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
                                    Enregistrement...
                                </>
                            ) : (
                                isEditing ? 'Enregistrer' : 'Ajouter'
                            )}
                        </Button>
                    </Col>
                </Row>
            </Form>
        </div>
    );
};

AvenantForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    initialConventionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    conventionCode: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string,
};

AvenantForm.defaultProps = {
    itemId: null,
    initialConventionId: null,
    conventionCode: '',
    onItemCreated: () => {},
    onItemUpdated: () => {},
    baseApiUrl: 'http://localhost:8000/api',
};

export default AvenantForm;
