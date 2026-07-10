"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_STATE = void 0;
function last7DaysSteps(base) {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
            date: d.toISOString().slice(0, 10),
            count: base + Math.floor(Math.random() * 2200),
        });
    }
    return days;
}
const now = new Date();
const yesterday = new Date(now.getTime() - 86400000);
const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);
exports.SEED_STATE = {
    currentUserId: null,
    selectedParentId: 'parent-1',
    users: [
        {
            id: 'child-1',
            name: 'Priya Sharma',
            email: 'priya@example.com',
            phoneNumber: '+919900000111',
            role: 'child',
            linkedUsers: ['parent-1', 'parent-2'],
        },
        {
            id: 'child-2',
            name: 'Amit Sharma',
            email: 'amit@example.com',
            phoneNumber: '+919900000222',
            role: 'child',
            linkedUsers: ['parent-1', 'parent-2'],
        },
        {
            id: 'parent-1',
            name: 'Ramesh Sharma',
            email: 'ramesh@example.com',
            phoneNumber: '+919900000333',
            role: 'parent',
            linkedUsers: ['child-1', 'child-2'],
        },
        {
            id: 'parent-2',
            name: 'Sunita Sharma',
            email: 'sunita@example.com',
            phoneNumber: '+919900000444',
            role: 'parent',
            linkedUsers: ['child-1', 'child-2'],
        },
    ],
    parents: [
        {
            id: 'parent-1',
            name: 'Ramesh Sharma',
            city: 'Jaipur',
            age: 72,
            stepsData: last7DaysSteps(1500),
            lastPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=300&fit=crop',
            lastPhotoTimestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
            id: 'parent-2',
            name: 'Sunita Sharma',
            city: 'Jaipur',
            age: 68,
            stepsData: last7DaysSteps(1800),
            lastPhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop',
            lastPhotoTimestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        },
    ],
    taskTemplates: [
        {
            id: 'task-1',
            familyId: 'family-demo',
            assignedParentId: 'parent-1',
            createdByChildId: 'child-1',
            title: 'Morning medicines',
            time: '08:00',
            startDate: twoDaysAgo.toISOString().slice(0, 10),
            repeat: 'daily',
            ringAlarm: true,
            requiresPhoto: true,
            isActive: true,
            nextOccurrenceAt: new Date().toISOString(),
            createdAt: twoDaysAgo.toISOString(),
            updatedAt: twoDaysAgo.toISOString(),
        },
        {
            id: 'task-2',
            familyId: 'family-demo',
            assignedParentId: 'parent-1',
            createdByChildId: 'child-1',
            title: 'Walk in the park',
            time: '17:00',
            startDate: twoDaysAgo.toISOString().slice(0, 10),
            repeat: 'daily',
            ringAlarm: false,
            requiresPhoto: false,
            isActive: true,
            nextOccurrenceAt: new Date().toISOString(),
            createdAt: twoDaysAgo.toISOString(),
            updatedAt: twoDaysAgo.toISOString(),
        },
        {
            id: 'task-3',
            familyId: 'family-demo',
            assignedParentId: 'parent-2',
            createdByChildId: 'child-1',
            title: 'Blood pressure check',
            time: '10:00',
            startDate: yesterday.toISOString().slice(0, 10),
            repeat: 'weekly',
            ringAlarm: true,
            requiresPhoto: true,
            isActive: true,
            nextOccurrenceAt: new Date().toISOString(),
            createdAt: yesterday.toISOString(),
            updatedAt: yesterday.toISOString(),
        },
        {
            id: 'task-4',
            familyId: 'family-demo',
            assignedParentId: 'parent-2',
            createdByChildId: 'child-1',
            title: 'Evening tea reminder',
            time: '16:30',
            startDate: yesterday.toISOString().slice(0, 10),
            repeat: 'daily',
            ringAlarm: false,
            requiresPhoto: false,
            isActive: true,
            nextOccurrenceAt: new Date().toISOString(),
            createdAt: yesterday.toISOString(),
            updatedAt: yesterday.toISOString(),
        },
    ],
    taskOccurrences: [
        {
            id: `occ-task-3-${yesterday.toISOString()}`,
            taskId: 'task-3',
            assignedParentId: 'parent-2',
            scheduledFor: yesterday.toISOString(),
            status: 'done',
            completedAt: yesterday.toISOString(),
            completedBy: 'parent-2',
            photoRequired: true,
            photoConfirmed: true,
            proofUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&h=200&fit=crop',
            createdAt: yesterday.toISOString(),
            updatedAt: yesterday.toISOString(),
        },
    ],
    taskAlarmRecords: [],
    documents: [
        {
            id: 'doc-1',
            category: 'medical',
            name: 'Prescription - Dr. Mehta',
            fileUrl: '',
            uploadDate: new Date(Date.now() - 86400000 * 14).toISOString(),
            expiryDate: new Date(Date.now() + 86400000 * 90).toISOString(),
        },
        {
            id: 'doc-2',
            category: 'bill',
            name: 'Electricity bill - March',
            fileUrl: '',
            uploadDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
    ],
    emergencyRoutines: [
        {
            parentId: 'parent-1',
            steps: [
                { order: 1, action: 'notify_child' },
                {
                    order: 2,
                    action: 'call_contact',
                    contactName: 'Neighbor - Suresh',
                    contactPhone: '+919876543210',
                },
                { order: 3, action: 'call_ambulance' },
                { order: 4, action: 'share_location' },
            ],
        },
        {
            parentId: 'parent-2',
            steps: [
                { order: 1, action: 'notify_child' },
                {
                    order: 2,
                    action: 'call_contact',
                    contactName: 'Sister - Kavita',
                    contactPhone: '+919812345678',
                },
                { order: 3, action: 'call_ambulance' },
            ],
        },
    ],
    remoteSetups: [
        {
            ownerUserId: 'parent-1',
            configuredByUserId: 'child-1',
            checklist: {
                explainedScreenSharing: true,
                accessibilityServiceEnabled: true,
                notificationPermissionGranted: true,
                batteryOptimizationExempted: true,
                whatsAppInstalled: true,
                trustedContactsAdded: true,
            },
            trustedContacts: [
                {
                    id: 'remote-contact-1',
                    name: 'Priya Sharma',
                    phoneNumber: '+919900000111',
                    role: 'child',
                    linkedUserId: 'child-1',
                    whatsAppVerified: true,
                },
                {
                    id: 'remote-contact-2',
                    name: 'Amit Sharma',
                    phoneNumber: '+919900000222',
                    role: 'child',
                    linkedUserId: 'child-2',
                    whatsAppVerified: true,
                },
            ],
            completedAt: new Date(Date.now() - 86400000).toISOString(),
        },
    ],
    remoteHelpSessions: [],
};
